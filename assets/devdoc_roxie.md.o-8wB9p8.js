import{_ as e,c as t,o as a,V as o}from"./chunks/framework.gBlNPWt_.js";const f=JSON.parse('{"title":"Everything you ever wanted to know about Roxie","description":"","frontmatter":{},"headers":[],"relativePath":"devdoc/roxie.md","filePath":"devdoc/roxie.md","lastUpdated":1719918396000}'),i={name:"devdoc/roxie.md"},n=o(`<h1 id="everything-you-ever-wanted-to-know-about-roxie" tabindex="-1">Everything you ever wanted to know about Roxie <a class="header-anchor" href="#everything-you-ever-wanted-to-know-about-roxie" aria-label="Permalink to &quot;Everything you ever wanted to know about Roxie&quot;">​</a></h1><h2 id="why-did-i-create-it" tabindex="-1">Why did I create it? <a class="header-anchor" href="#why-did-i-create-it" aria-label="Permalink to &quot;Why did I create it?&quot;">​</a></h2><p>Because I could. Many of the pieces needed for Roxie were already created for use in other systems – ECL language, code generator, index creation in Thor, etc. Indexes could be used by Moxie, but that relied on monolithic single-part indexes, was single-threaded (forked a process per query) and had limited ability to do any queries beyond simple index lookups. ECL had already proved itself as a way to express more complex queries concisely, and the concept of doing the processing next to the data had been proved in hOle and Thor, so Roxie – using the same concept for online queries using indexes – was a natural extension of that, reusing the existing index creation and code generation, but adding a new run-time engine geared towards pre-deployed queries and sending index lookup requests to the node holding the index data.</p><h2 id="how-do-activities-link-together" tabindex="-1">How do activities link together? <a class="header-anchor" href="#how-do-activities-link-together" aria-label="Permalink to &quot;How do activities link together?&quot;">​</a></h2><p>The code generator creates a graph (DAG) representing the query, with one node per activity and links representing the inputs and dependencies. There is also a helper class for each activity.</p><p>Roxie loads this graph for all published queries, creating a factory for each activity and recording how they are linked. When a query is executed, the factories create the activity instances and link them together. All activities without output activities (known as ‘sinks’) are then executed (often on parallel threads), and will typically result in a value being written to a workunit, to the socket that the query was received in, or to a global “context” area where subsequent parts of the query might read it.</p><p>Data is pulled through the activity graph, by any activity that wants a row from its input requesting it. Evaluation is therefore lazy, with data only calculated as needed. However, to reduce latency in some cases activities will prepare results ahead of when they are requested – for example an index read activity will send the request to the agent(s) as soon as it is started rather than waiting for the data to be requested by its downstream activity. This may result in wasted work, and in some cases may result in data coming back from an agent after the requesting query has completed after discovering it didn’t need it after all – this results in the dreaded “NO msg collator found – using default” tracing (not an error but may be indicative of a query that could use some tuning).</p><p>Before requesting rows from an input, it should be started, and when no more rows are required it should be stopped. It should be reset before destruction or reuse (for example for the next row in a child query).</p><p>Balancing the desire to reduce latency with the desire to avoid wasted work can be tricky. Conditional activities (IF etc) will not start their unused inputs, so that queries can be written that do different index reads depending on the input. There is also the concept of a “delayed start” activity – I would need to look at the code to remind myself of how those are used.</p><h2 id="where-are-the-dragons" tabindex="-1">Where are the Dragons? <a class="header-anchor" href="#where-are-the-dragons" aria-label="Permalink to &quot;Where are the Dragons?&quot;">​</a></h2><p>Splitter activities are a bit painful – they may result in arbitrary buffering of the data consumed by one output until another output is ready to request a row. It’s particularly complex when some of the outputs don’t start at all – the splitter needs to keep track of how many of the inputs have been started and stopped (an input that is not going to be used must be stopped, so that splitters know not to keep data for them). Tracking these start/stop/reset calls accurately is very important otherwise you can end up with weird bugs including potential crashes when activities are destroyed. Therefore we report errors if the counts don’t tally properly at the end of a query – but working out where a call was missed is often not trivial. Usually it’s because of an exception thrown from an unexpected place, e.g. midway through starting.</p><p>Note that row requests from the activities above a splitter may execute on whichever thread downstream from the splitter happens to need that particular row first.</p><p>The splitter code for tracking whether any of the downstream activities still need a row is a bit hairy/inefficient, IIRC. There may be scope to optimize (but I would recommend adding some good unit test cases first!)</p><h2 id="how-does-i-beat-you-to-it-work" tabindex="-1">How does “I beat you to it” work? <a class="header-anchor" href="#how-does-i-beat-you-to-it-work" aria-label="Permalink to &quot;How does “I beat you to it” work?&quot;">​</a></h2><p>When there are multiple agents fulfilling data on a channel, work is shared among them via a hash of the packet header, which is used to determine which agent should work on that packet. However, if it doesn’t start working on it within a short period (either because the node is down, or because it is too busy on other in-flight requests), then another node may take over. The IBYTI messages are used to indicate that a node has started to work on a packet and therefore there is no need for a secondary to take over.</p><p>The priority of agents as determined by the packet hash is also used to determine how to proceed if an IBYTI is received after starting to work on a request. If the IBYTI is from a lower priority buddy (sub-channel) then it is ignored, if it’s from a higher priority one then the processing will be abandoned.</p><p>When multicast is enabled, the IBYTI is sent on the same multicast channel as the original packet (and care is needed to ignore ones sent by yourself). Otherwise it is sent to all buddy IPs.</p><p>Nodes keep track of how often they have had to step in for a supposedly higher priority node, and reduce their wait time before stepping in each time this happens, so if a node has crashed then the buddy nodes will end up taking over without every packet being delayed.</p><p>(QUESTION – does this result in the load on the first node after the failed node getting double the load?)</p><p>Newer code for cloud systems (where the topology may change dynamically) send the information about the buddy nodes in the packet header rather than assuming all nodes already have a consistent version of that information. This ensures that all agents are using the same assumptions about buddy nodes and their ordering.</p><h2 id="all-about-index-compression" tabindex="-1">All about index compression <a class="header-anchor" href="#all-about-index-compression" aria-label="Permalink to &quot;All about index compression&quot;">​</a></h2><p>An index is basically a big sorted table of the keyed fields, divided into pages, with an index of the last row from each page used to be able to locate pages quickly. The bottom level pages (‘leaves’) may also contain payload fields that do not form part of the lookup but can be returned with it.</p><p>Typical usage within LN Risk tends to lean towards one of two cases:</p><ul><li>Many keyed fields with a single “ID” field in the payload</li><li>A single “ID” field in the key with many “PII” fields in the payload.</li></ul><p>There may be some other cases of note too though – e.g. an error code lookup file which heavily, used, or Boolean search logic keys using smart-stepping to implement boolean search conditions.</p><p>It is necessary to store the index pages on disk compressed – they are very compressible – but decompression can be expensive. For this reason traditionally we have maintained a cache of decompressed pages in addition to the cache of compressed pages that can be found in the Linux page cache. However, it would be much preferred if we could avoid decompressing as much as possible, ideally to the point where no significant cache of the decompressed pages was needed.</p><p>Presently we need to decompress to search, so we’ve been looking at options to compress the pages in such a way that searching can be done using the compressed form. The current design being played with here uses a form of DFA to perform searching/matching on the keyed fields – the DFA data is a compact representation of the data in the keyed fields but is also efficient to use as for searching. For the payload part, we are looking at several options (potentially using more than one of them depending on the exact data) including:</p><ul><li>Do not compress (may be appropriate for ID case, for example)</li><li>Compress individual rows, using a shared dictionary (perhaps trained on first n rows of the index)</li><li>Compress blocks of rows (in particular, rows that have the same key value)</li></ul><p>A fast (to decompress) compression algorithm that handles small blocks of data efficiently is needed. Zstd may be one possible candidate.</p><p>Preliminary work to enable the above changes involved some code restructuring to make it possible to plug in different compression formats more easily, and to vary the compression format per page.</p><h2 id="what-is-the-topology-server-for" tabindex="-1">What is the topology server for? <a class="header-anchor" href="#what-is-the-topology-server-for" aria-label="Permalink to &quot;What is the topology server for?&quot;">​</a></h2><p>It’s used in the cloud to ensure that all nodes can know the IP addresses of all agents currently processing requests for a given channel. These addresses can change over time due to pod restarts or scaling events. Nodes report to the topology server periodically, and it responds to them with the current topology state. There may be multiple topology servers running (for redundancy purposes). If so all reports should go to all, and it should not matter which one’s answer is used. (QUESTION – how is the send to all done?)</p><h2 id="lazy-file-io" tabindex="-1">Lazy File IO <a class="header-anchor" href="#lazy-file-io" aria-label="Permalink to &quot;Lazy File IO&quot;">​</a></h2><p>All IFileIO objects used to read files from Roxie are instantiated as IRoxieLazyFileIO objects, which means:</p><ul><li><p>The underlying file handles can be closed in the background, in order to handle the case where file handles are a limited resource. The maximum (and minimum) number of open files can be configured separately for local versus remote files (sometimes remote connections are a scarcer resource than local, if there are limits at the remote end).</p></li><li><p>The actual file connected to can be switched out in the background, to handle the case where a file read from a remote location becomes unavailable, and to switch to reading from a local location after a background file copy operation completes.</p></li></ul><h2 id="new-ibyti-mode" tabindex="-1">New IBYTI mode <a class="header-anchor" href="#new-ibyti-mode" aria-label="Permalink to &quot;New IBYTI mode&quot;">​</a></h2><p>Original IBYTI implementation allocated a thread (from the pool) to each incoming query packet, but some will block for a period to allow an IBYTI to arrive to avoid unnecessary work. It was done this way for historical reasons - mainly that the addition of the delay was after the initial IBYTI implementation, so that in the very earliest versions there was no priority given to any particular subchannel and all would start processing at the same time if they had capacity to do so.</p><p>This implementation does not seem particularly smart - in particular it&#39;s typing up worker threads even though they are not actually working, and may result in the throughput of the Roxie agent being reduced. For that reason an alternative implementation (controlled by the NEW_IBYTI flag) was created during the cloud transition which tracks what incoming packets are waiting for IBYTI expiry via a separate queue, and they are only allocated to a worker thread once the IBYTI delay times out.</p><p>So far the NEW_IBYTI flag has only been set on containerized systems (simply to avoid rocking the boat on the bare-metal systems), but we may turn on in bare metal too going forward (and if so, the old version of the code can be removed sooner or later).</p><h2 id="testing-roxie-code" tabindex="-1">Testing Roxie code <a class="header-anchor" href="#testing-roxie-code" aria-label="Permalink to &quot;Testing Roxie code&quot;">​</a></h2><p>Sometimes when developing/debugging Roxie features, it&#39;s simplest to run a standalone executable. Using server mode may be useful if wanting to debug server/agent traffic messaging.</p><p>For example, to test IBYTI behaviour on a single node, use</p><pre><code>./a.out --server --port=9999 --traceLevel=1 --logFullQueries=1 --expert.addDummyNode --roxieMulticastEnabled=0 --traceRoxiePackets=1
</code></pre><p>Having first compiled a suitable bit of ECL into a.out. I have found a snippet like this quite handy:</p><pre><code>rtl := SERVICE
 unsigned4 sleep(unsigned4 _delay) : eclrtl,action,library=&#39;eclrtl&#39;,entrypoint=&#39;rtlSleep&#39;;
END;

d := dataset([{rtl.sleep(5000)}], {unsigned a});
allnodes(d)+d;
</code></pre><h2 id="cache-prewarm" tabindex="-1">Cache prewarm <a class="header-anchor" href="#cache-prewarm" aria-label="Permalink to &quot;Cache prewarm&quot;">​</a></h2><p>Roxie (optionally) maintains a list of the most recently accessed file pages (in a circular buffer), and flushes this information periodically to text files that will persist from one run of Roxie to the next. On startup, these files are processed and the relevant pages preloaded into the linux page cache to ensure that the &quot;hot&quot; pages are already available and maximum performance is available immediately once the Roxie is brought online, rather than requiring a replay of a &quot;typical&quot; query set to heat the cache as used to be done. In particular this should allow a node to be &quot;warm&quot; before being added to the cluster when autoscaling.</p><p>There are some questions outstanding about how this operates that may require empirical testing to answer. Firstly, how does this interact with volumes mounted via k8s pvc&#39;s, and in particular with cloud billing systems that charge per read. Will the reads that are done to warm the cache be done in large chunks, or will they happen one linux page at a time? The code at the Roxie level operates by memory-mapping the file then touching a byte within each linux page that we want to be &quot;warm&quot;, but does the linux paging subsystem fetch larger blocks? Do huge pages play a part here?</p><p>Secondly, the prewarm is actually done by a child process (ccdcache), but the parent process is blocked while it happens. It would probably make sense to at allow at least some of the other startup operations of the parent process to proceed in parallel. There are two reasons why the cache prewarm is done using a child process. Firstly is to allow there to be a standalone way to prewarm prior to launching a Roxie, which might be useful for automation in some bare-metal systems. Secondly, because there is a possibility of segfaults resulting from the prewarm if the file has changed size since the cache warming was done, it is easier to contain, capture, and recover from such faults in a child process than it would be inside Roxie. However, it would probably be possible to avoid these segfaults (by checking more carefully against file size before trying to warm a page, for example) and then link the code into Roxie while still keeping the code common with the standalone executable version.</p><p>Thirdly, need to check that the prewarm is complete before adding a new agent to the topology. This is especially relevant if we make any change to do the prewarm asynchronously.</p><p>Fourthly, there are potential race conditions when reading/writing the file containing cache information, since this file may be written by any agent operating on the same channel, at any time.</p><p>Fifthly, how is the amount of information tracked decided? It should be at least related to the amount of memory available to the linux page cache, but that&#39;s not a completely trivial thing to calculate. Should we restrict to the most recent N when outputting, where N is calculated from, for example /proc/meminfo&#39;s Active(file) value? Unfortunately on containerized sytems that reflects the host, but perhaps /sys/fs/cgroup/memory.stat can be used instead?</p><p>When deciding how much to track, we can pick an upper limit from the pod&#39;s memory limit. This could be read from /sys/fs/cgroup/memory.max though we currently read from the config file instead. We should probably (a) subtract the roxiemem size from that and (b) think about a value that will work on bare-metal and fusion too. However, because we don&#39;t dedup the entries in the circular buffer used for tracking hot pages until the info is flushed, the appropriate size is not really the same as the memory size.</p><p>We track all reads by page, and before writing also add all pages in the jhtree cache with info about the node type. Note that a hit in the jhtree page cache won&#39;t be noted as a read OTHER than via this last-minute add.</p><h2 id="blacklisting-sockets" tabindex="-1">Blacklisting sockets <a class="header-anchor" href="#blacklisting-sockets" aria-label="Permalink to &quot;Blacklisting sockets&quot;">​</a></h2><p>This isn&#39;t really specific to Roxie, but was originally added for federated Roxie systems...</p><p>When a Roxie query (or hthor/thor) makes a SOAPCALL, there is an option to specify a list of target gateway IPs, and failover to the next in the list if the first does not respond in a timely fashion. In order to avoid this &quot;timely fashion&quot; check adding an overhead to every query made when a listed gateway is unavailable, we maintain a &quot;blacklist&quot; of nodes that have been seen to fail, and do not attempt to connect to them. There is a &quot;deblacklister&quot; thread that checks periodically whether it is now possible to connect to a previously-blacklisted gateway, and removes it from the list if so.</p><p>There are a number of potential questions and issues with this code:</p><ol><li>It would appear that a blacklist is applied even when there is only one gateway listed. In this case, the blacklist may be doing more harm than good? I&#39;m not sure that is true - it is still causing rapid failures in cases that are never going to work...</li><li>Even when there is only one gateway listed, a blacklist MIGHT still be useful (you don&#39;t really want EVERY query to block trying to connect, if the gateway is down - may prefer a fast failure). Also applies when there are multiple records, all being passed to a gateway, and with an ONFAIL.</li><li>Is the blacklist shared between all queries? I&#39;m pretty sure it is NOT shared across Roxie nodes... Looks like it is a global object, shared between all queries and activities. However, connections that were started in parallel will all be reported as failed rather than blacklisted, which can make it look like it is maintained per-activity.</li><li>Is it only a failed connect that leads to blacklisting, or does a slow/error response also cause a gateway endpoint to be blacklisted? It&#39;s only a failed connect.</li><li>When deblacklisting, can we check any condition other than &quot;Successfully connected&quot;? If not, blacklisting for any reason other than &quot;Did not connect&quot; feels like a recipe for problems. We only check for a connection (and correspondingly only blacklist for a failed connection).</li><li>Are we ever using the functionality where there are more than one gateway listed? Most of the time a load-balancer is a preferable solution...</li><li>The &quot;deblacklister&quot; thread seems to add an escalating delay between attempts. Is this delay ever reset? Is it configurable? Is it appropriate?</li><li>There&#39;s a thread (in the blacklister&#39;s pool) for each blacklisted endpoint. These threads will never go away if the endpoint does not recover...</li><li>There&#39;s a delay of up to 10 seconds in terminating caused by the deblacklister&#39;s connect having to timeout before it notices that we are stopping. Can we close the socket as well as interrupting the semaphore?</li><li>Does the &quot;reconnect&quot; attempt from the deblacklister cause any pain for the server it is connecting to? Lots of connect attempts without any data could look like a DoS attack...</li><li>Retries/timeout seems to translate to <code>Owned&lt;ISocketConnectWait&gt; scw = nonBlockingConnect(ep, timeoutMS == WAIT_FOREVER ? 60000 : timeoutMS*(retries+1));</code> I am not sure that is correct (a single attempt to connect with a long timeout doesn&#39;t feel like it is the same as multiple attempts with shorter timeouts, for example if there is a load balancer in the mix).</li><li>Perhaps an option to not use blacklister would solve the immediate issue?</li><li>The blacklister uses an array of endpoints - If there were a lot blacklisted, a hash table would be better</li><li>Hints to control behaviour of deblacklister would behave unpredictably if multiple activities connected to the same endpoint with different hints unless we make the blacklist lookup match the hint values too.</li><li>Deblacklister should use nonBlockingConnect too.</li></ol><p>Should the scope of the blacklist be different? Possible scopes are:</p><ol><li>Shared across all queries/activities (current behaviour)</li><li>Specific to an activity, but shared across queries (i.e. owned by the activity factory)</li><li>Specific to all activities in a deployed query (i.e. owned by the query factory)</li><li>Specific to a particular activity instance (i.e. owned by the activity object)</li><li>Specific to a particular query instance (i.e. owned by the query object)</li></ol><p>Options 2 and 4 above would allow all aspects of the blacklisting behaviour to be specified by options on the SOAPCALL. We could control whether or not the blacklister is to be used at all via a SOAPCALL option with any of the above...</p><h1 id="perftrace-options" tabindex="-1">perftrace options <a class="header-anchor" href="#perftrace-options" aria-label="Permalink to &quot;perftrace options&quot;">​</a></h1><p>The HPCC Platform includes a rudimentary performance tracing feature using periodic stack capture to generate flame graphs. Roxie supports this in 3 ways:</p><ol><li>If expert/@profileStartup is set in roxie config, a flame graph is generated for operations during Roxie startup phase.</li><li>If @perf is set on an incoming query, a flame graph is generated for the lifetime of that query&#39;s execution, and returned along with the query results</li><li>If expert/perftrace is set in roxie config, one-shot roxie queries (e.g. eclagent mode) generate a flame graph (currently just to a text file).</li></ol><p>The perf trace operates as follows:</p><ol><li>A child process is launched that runs the doperf script. This samples the current stack(s) every 0.2s (configurable) to a series of text files.</li><li>When tracing is done, these text files are &quot;folded&quot; via a perl script that notes every unique stack and how many times it was seen, one line per unique stack</li><li>This folded stack list is filtered to suppress some stacks that are not very interesting</li><li>The filtered folded stack list is passed to another perl script that generates an svg file.</li></ol><p>The basic info captured at step 1 (or maybe 2) could also be analysed to give other insights, such as:</p><ol><li>A list of &quot;time in function, time in children of function&quot;.</li><li>An expanded list of callers to __GI___lll_lock_wait and __GI___lll_lock_wake, to help spot contended critsecs.</li></ol><p>Unfortunately some info present in the original stack text files is lost in the folded summary - in particular related to the TID that the stack is on. Can we spot lifetimes of threads and/or should we treat &quot;stacks&quot; on different threads as different? Thread pools might render this difficult though. There is an option in stack-collapse-elfutils.pl to include the TID when considering whether stacks match, so perhaps we should just (optionally) use that.</p><h1 id="some-notes-on-localagent-mode" tabindex="-1">Some notes on LocalAgent mode <a class="header-anchor" href="#some-notes-on-localagent-mode" aria-label="Permalink to &quot;Some notes on LocalAgent mode&quot;">​</a></h1><p>In localAgent mode, the global queueManager object (normally a RoxieUdpSocketQueueManager) is replaced by a RoxieLocalQueueManager. Outbound packets are added directly to target queue, inbound are packed into DataBuffers.</p><p>There is also &quot;local optimizations&quot; mode where any index operation reading a one-part file (does the same apply to one-part disk files?) just reads it directly on the server (regardless of localAgent setting). Typically still injected into receiver code though as otherwise handling exception cases, limits etc would all be duplicated/messy. Rows created in localOptimization mode are created directly in the caller&#39;s row manager, and are injected in serialized format.</p><p>Why are inbound not created directly in the desired destination&#39;s allocator and then marked as serialized? Some lifespan issues... are they insurmountable? We do pack into dataBuffers rather than MemoryBuffers, which avoids a need to copy the data before the receiver can use it. Large rows get split and will require copying again, but we could set dataBufferSize to be bigger in localAgent mode to mitigate this somewhat.</p><p>What is the lifespan issue? In-flight queries may be abandoned when a server-side query fails, times out, or no longer needs the data. Using DataBuffer does not have this issue as they are attached to the query&#39;s memory manager/allocation once read. Or we could bypass the agent queue altogether, but rather more refactoring needed for that (might almost be easier to extent the &quot;local optimization&quot; mode to use multiple threads at that point)</p><p>abortPending, replyPending, and abortPendingData methods are unimplemented, which may lead to some inefficiencies?</p><h1 id="some-notes-on-udp-packet-sending-mechanism" tabindex="-1">Some notes on UDP packet sending mechanism <a class="header-anchor" href="#some-notes-on-udp-packet-sending-mechanism" aria-label="Permalink to &quot;Some notes on UDP packet sending mechanism&quot;">​</a></h1><p>Requests from server to agents are send via UDP (and have a size limit of 64k as a result). Historically they were sent using multicast to go to all agents on a channel at the same time, but since most cloud providers do not support multicast, there has long been an option to avoid multicast and send explicitly to the agent IPs. In bare metal systems these IPs are known via the topology file, and do not change. In cloud systems the topology server provides the IPs of all agents for a channel.</p><p>In cloud systems, the list of IPs that a message was sent to is included in the message header, so that the IBYTI messages can be sent without requiring that all agents/servers have the same topology information at any given moment (they will stay in sync because of topology server, but may be temporarily out of sync when nodes are added/removed, until next time topology info is retrieved). This is controled by the SUBCHANNELS_IN_HEADER define.</p><p>Packets back from agents to server go via the udplib message-passing code. This can best be described by looking at the sending and receiving sides separately.</p><p>When sending, results are split into individual packets (DataBuffers), each designed to be under 1 MTU in size. Traditionally this meant they were 1k, but they can be set larger (8k is good). They do have to be a power of 2 because of how they are allocated from the roxiemem heap. The sender maintains a set of UdpReceiverEntry objects, one for each server that it is conversing with. Each UdpReceiverEntry maintains multiple queues of data packets waiting to be sent, one queue for each priority. The UdpReceiverEntry maintains a count of how many packets are contained across all its queues in packetsQueued, so that it knows if there is data to send.</p><p>The priority levels are: 0: Out Of Band 1: Fast lane 2: Standard</p><p>This is designed to allow control information to be sent without getting blocked by data, and high priority queries to avoid being blocked by data going to lower priority ones. The mechanism for deciding what packet to send next is a little odd though - rather than sending all higher-priorty packets before any lower-priority ones, it round robins across the queues sending up to N^2 from queue 0 then up to N from queue 1 then 1 from queue 2, where N is set by the UdpOutQsPriority option, or 1 if not set. This may be a mistake - probably any from queue 0 should be sent first, before round-robining the other queues in this fashion.</p><p>UdpReceiverEntry objects are also responsible for maintaining a list of packets that have been sent but receiver has not yet indicated that they have arrived.</p><p>If an agent has data ready for a given receiver, it will send a requestToSend to that receiver, and wait for a permitToSend response. Sequence numbers are used to handle situations where these messages get lost. A permitToSend that does not contain the expected sequence number is ignored.</p>`,85),s=[n];function r(l,h,d,c,p,u){return a(),t("div",null,s)}const g=e(i,[["render",r]]);export{f as __pageData,g as default};
