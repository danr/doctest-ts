/** Does this string contain foo, ignoring case?

    hasFoo('___foo__') // => true
    hasFoo('   fOO  ') // => true
    hasFoo('Foo.') // => true
    hasFoo('bar') // => false
    hasFoo('fo') // => false
    hasFoo('oo') // => false

*/
function hasFoo(s: string): boolean {
  return null != s.match(/foo/i)
}
