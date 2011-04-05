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