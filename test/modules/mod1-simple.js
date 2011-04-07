/*!
  This is a license comment.
  It's a license comment because I put /*! at the start.
  That means it should be preserved, even through minification.
  Though there's no good way to preserve the position (atm)
   so they may appear all at the top of the minificated output.
*/
provide(function(exports) {
  var monitor = '';

  using('mod1_a', function(simple) {
    monitor.push('mod1_a' + simple);
    exports(function() {
      return monitor;
    });
  });

  using('sub/mod1_b', function(simple) {
    monitor.push('mod1_b' + simple);
  });

});