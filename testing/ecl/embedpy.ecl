IMPORT Python;

Python.Language.syntaxcheck('1+2');

integer add1(integer val) := EMBED(Python)
val+1
ENDEMBED;

string add2(string val) := EMBED(Python)
val+'1'
ENDEMBED;

string add3(varstring val) := EMBED(Python)
val+'1'
ENDEMBED;

utf8 add4(utf8 val) := EMBED(Python)
val+'1'
ENDEMBED;

unicode add5(unicode val) := EMBED(Python)
val+'1'
ENDEMBED;

utf8 add6(utf8 val) := EMBED(Python)
return val+'1'
ENDEMBED;

unicode add7(unicode val) := EMBED(Python)
return val+'1'
ENDEMBED;

integer testThrow(integer val) := EMBED(Python)
raise Exception('Error from Python')
ENDEMBED;

add1(10);
add2('Hello');
add3('World');
add4(U'Oh là là Straße');
add5(U'Стоял');
add6(U'Oh là là Straße');
add7(U'Стоял');

add2('Oh là là Straße');  // Passing latin chars - should be untranslated

// Can't catch an expression(only a dataset)
d := dataset([{ 1, '' }], { integer a, string m} ) : stored('nofold');

d t := transform
  self.a := FAILCODE;
  self.m := FAILMESSAGE;
  self := [];
end;

catch(d(testThrow(a) = a), onfail(t));

s1 :=DATASET(250000, TRANSFORM({ integer a }, SELF.a := add1(COUNTER)));
s2 :=DATASET(250000, TRANSFORM({ integer a }, SELF.a := add1(COUNTER/2)));
 SUM(NOFOLD(s1 + s2), a);

s1a :=DATASET(250000, TRANSFORM({ integer a }, SELF.a := (integer) add2((STRING)COUNTER)));
s2a :=DATASET(250000, TRANSFORM({ integer a }, SELF.a := (integer) add3((STRING)(COUNTER/2))));
 SUM(NOFOLD(s1a + s2a), a);

s1b :=DATASET(250000, TRANSFORM({ integer a }, SELF.a := COUNTER+1));
s2b :=DATASET(250000, TRANSFORM({ integer a }, SELF.a := (COUNTER/2)+1));
 SUM(NOFOLD(s1b + s2b), a);

s1c :=DATASET(250000, TRANSFORM({ integer a }, SELF.a := (integer) ((STRING) COUNTER + '1')));
s2c :=DATASET(250000, TRANSFORM({ integer a }, SELF.a := (integer) ((STRING)(COUNTER/2) + '1')));
 SUM(NOFOLD(s1c + s2c), a);
