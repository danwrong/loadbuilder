provide(function() {
  using('javascripts/script1.js', function() {  // S1 provides global S1 var
    using('mod4_a', function(a) { // A needs S1
      using('$../javascripts/script2.js', function() {  // S2 uses S1, provides global S2 var
        exports(a);
      });
    });
  });
});
