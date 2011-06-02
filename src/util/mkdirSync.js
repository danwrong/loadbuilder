/*
 * Adapted from @isaacs's mkdir-p... made sync...
 */

var fs = require("fs")
  , path = require("path")

module.exports = mkdirSync

function mkdirSync (ensure, mode) {
  mode = mode || 0755;
  ensure = ensure.replace(/\/+$/, '');
  if (ensure.charAt(0) !== "/") ensure = path.join(process.cwd(), ensure);
  try {
    var s = fs.statSync(ensure);
    if (s && s.isDirectory()) return;
  } catch (e) {}
  return walkDirs(ensure, mode);
}

function walkDirs (ensure, mode) {
  var dirs = ensure.split("/")
    , walker = [];

  walker.push(dirs.shift()) // gobble the "/" first
  ;(function S (d) {
    if (d === undefined) return;
    walker.push(d);
    var dir = walker.join("/");
    (function STATCB() {
      try {
        if (fs.statSync(dir).isDirectory()) {
          S(dirs.shift());
        } else {
          throw new Error("Failed to mkdir "+dir+": File exists");
        }
      } catch (e) {
        try {
          fs.mkdirSync(dir, mode);
          S(dirs.shift())
        } catch (er) {
          if (er.message.indexOf("EEXIST")) return STATCB();
          throw er;
        }
      }
    })();
  })(dirs.shift())
}