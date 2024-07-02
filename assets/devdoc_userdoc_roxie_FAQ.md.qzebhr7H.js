import{_ as s,c as a,o as e,V as t}from"./chunks/framework.gBlNPWt_.js";const m=JSON.parse('{"title":"ROXIE FAQs","description":"","frontmatter":{},"headers":[],"relativePath":"devdoc/userdoc/roxie/FAQ.md","filePath":"devdoc/userdoc/roxie/FAQ.md","lastUpdated":1719918396000}'),n={name:"devdoc/userdoc/roxie/FAQ.md"},o=t(`<h1 id="roxie-faqs" tabindex="-1">ROXIE FAQs <a class="header-anchor" href="#roxie-faqs" aria-label="Permalink to &quot;ROXIE FAQs&quot;">​</a></h1><ol><li><strong>How I can compile a query on a containerized or cloud-based system?</strong></li></ol><p><strong>Answer</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>Same way as bare metal. Command line, or with the IDE, or from ECL Watch. Just point to the HPCC Systems instance to compile.</span></span>
<span class="line"><span>For Example:</span></span>
<span class="line"><span>ecl deploy &lt;target&gt; &lt;file&gt;</span></span></code></pre></div><ol start="2"><li><strong>How do I copy queries from an on-prem cluster to Azure?</strong></li></ol><p><strong>Answer</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>The copy query command – use the Azure host name or IP address for the target.</span></span>
<span class="line"><span>For example:</span></span>
<span class="line"><span>ecl queries copy &lt;source_query_path&gt; &lt;target_queryset&gt;</span></span></code></pre></div><ol start="3"><li><strong>How can I get the IP address for the Azure target cluster?</strong></li></ol><p><strong>Answer</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>Use the &quot;kubectl get svc&quot; command. Use the external IP address listed for ECL Watch.</span></span>
<span class="line"><span>kubectl get svc</span></span></code></pre></div><ol start="4"><li><strong>Do we have to have use the DNSName or do we need to use the IP address?</strong></li></ol><p><strong>Answer</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>If you can reach ECL Watch with the DNS Name then it should also work for the command line.</span></span></code></pre></div><ol start="5"><li><strong>How can I find the ECL Watch or Dali hostname?</strong></li></ol><p><strong>Answer</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>If you did not set up the containerized instance, then you need to ask your Systems Administrator or whomever set it up..</span></span></code></pre></div><ol start="6"><li><strong>How do I publish a package file?</strong></li></ol><p><strong>Answer</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>Same way as bare metal.</span></span>
<span class="line"><span>To add a new package file: ecl packagemap add or</span></span>
<span class="line"><span>To copy exisitng package file : ecl packagemap copy</span></span></code></pre></div><ol start="7"><li><strong>How do I check the logs?</strong></li></ol><p><strong>Answer</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>kubectl log &lt;podname&gt;</span></span>
<span class="line"><span>in addition you can use -f (follow) option to tail the logs. Optionally you can also issue the &lt;namespace&gt; parameter.</span></span>
<span class="line"><span>For example:</span></span>
<span class="line"><span>kbectl log roxie-agent-1-3b12a587b –namespace MyNameSpace</span></span>
<span class="line"><span>Optionally, you may have implemented a log-processing solution such as the Elastic Stack (elastic4hpcclogs).</span></span></code></pre></div><ol start="8"><li><strong>How do I get the data on to Azure?</strong></li></ol><p><strong>Answer</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>Use the copy query command and copy or add the Packagemap.</span></span>
<span class="line"><span>With data copy start in the logs…copy from remote location specified if data doesn’t exist on the local system.</span></span>
<span class="line"><span>The remote location is the remote Dali (use the --daliip=&lt;daliIP&gt; parameter to specify the remote Dali)</span></span>
<span class="line"><span>You can also use ECL Watch.</span></span></code></pre></div><ol start="9"><li><strong>How can I start a cloud cluster? (akin to the old Virtual Box image)?</strong></li></ol><p><strong>Answer</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>Can use Docker Desktop, or Azure or any cloud provider and install the HPCC Systems Cloud native helm</span></span>
<span class="line"><span>charts</span></span></code></pre></div><ol start="10"><li><strong>How can I show the ECL queries that are published to a given Roxie?</strong></li></ol><p><strong>Answer</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>Can use WUListQueries</span></span>
<span class="line"><span>For example:</span></span>
<span class="line"><span>https://[eclwatch]:18010/WsWorkunits/WUListQueries.json?ver_=1.86&amp;ClusterName=roxie&amp;CheckAllNodes=0</span></span></code></pre></div><ol start="11"><li><strong>I set up persistent storage on my containerized HPCC Systems, and now it won&#39;t start. Why?</strong></li></ol><p><strong>Answer</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>One possible reason may be that all of the required storage directories are not present. The directories for ~/</span></span>
<span class="line"><span>hpccdata/dalistorage, hpcc-data, debug, queries, sasha, and dropzone are all required to exist or your cluster may not start.</span></span></code></pre></div><ol start="12"><li><strong>Are there any new methods available to work with queries?</strong></li></ol><p><strong>Answer</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span>Yes. There is a new method available ServiceQuery.</span></span>
<span class="line"><span>https://[eclwatch]:18010/WsResources/ServiceQuery?ver_=1.01&amp;</span></span>
<span class="line"><span>For example Roxie Queries:</span></span>
<span class="line"><span>https://[eclwatch]:18010/WsResources/ServiceQuery?ver_=1.01&amp;Type=roxie</span></span>
<span class="line"><span>or WsECL (eclqueries)</span></span>
<span class="line"><span>https://[eclwatch]:18010/WsResources/ServiceQuery?ver_=1.01&amp;Type=eclqueries</span></span></code></pre></div>`,37),p=[o];function l(i,r,c,d,h,g){return e(),a("div",null,p)}const v=s(n,[["render",l]]);export{m as __pageData,v as default};
