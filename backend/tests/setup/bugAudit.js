// BUG_AUDIT=1 runs every `test.failing` / `it.failing` as an ordinary test, so
// the reason each known-bug test fails can be read and checked: it must fail on
// the assertion that describes the bug, never on broken setup.
//   BUG_AUDIT=1 npx jest -t "BUG-"
if (process.env.BUG_AUDIT) {
  for (const fn of [global.test, global.it]) {
    fn.failing = fn;
  }
}
