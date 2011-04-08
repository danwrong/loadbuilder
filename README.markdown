loadbuilder.js (JavaScript dependency builder for [Loadrunner.js](https://github.com/danwrong/loadrunner))
----------------------------------------------------------------

(c) Twitter 2011 under an MIT License (attached)

Overview
--------

Loadbuilder uses nodejs to build your loadrunner modules into simple bundles for production loading.

Get
---

Download this package.

Install
-------

cd into this folder and use npm to install it
    npm install .

Test
----

We use expresso to run the tests
    npm install expresso
    cd test
    expresso shot.js

Command Line
------------

    Usage: loadbuilder [options] file

    Document root
        -d, --docRoot <value>
    Output root
        -o, --distRoot <value>
    Module path, relative to document root
        -m, --modPath <value>
    Don't minify
        -nm, --nomin
    Exclude scripts
        -x, --exclude <value>
    Run JSHint to log (info)
        -h, --hint
    Log Level - 0:none, 1:errors, 2:info
        -l, --logLevel <value>

    loadbuilder <module>

Loads the module from 'modules' folder and all dependencies.  Compiles them into a single file, and outputs it with the same name into 'dist/modules' folder.

    loadbuilder -d <docroot> -m <modpath> -o <distroot> <module>

Loads the module from '<docroot>/<modpath>' folder and all dependencies.  Compiles them into a single file, and outputs it with the same name into '<distroot>/<modpath>' folder.

API
---

    var loadbuilder = require('loadbuilder');

    var myBuilder = loadbuilder.builder({
      docRoot: 'test',
      modPath: 'modules',
      distRoot: 'test/dist',
      logLevel: 3
    });

Loads the loadbuilder library and configures a builder.

    phoenixBuilder.bundle('mod1-simple');

Bundles module.  Outputs to 'test/dist/modules/mod1-simple.js'

....  More stuff

Feedback appreciated as always.