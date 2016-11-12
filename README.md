# kivalensjs

A re-thinking and re-implementation of KivaLens as a React app rather than a Silverlight app.

Using React, Reflux, react-bootstrap, gulp, browserify, node, ES6, babel (JSX, ES6 transpiler), Kiva API,
linqjs, Highcharts, ...

Contact me if you're interested in contributing.

This is my first React app and there are a number of things that I'd do differently now... and will
eventually change. Don't judge too harshly. :D

[See the live version](http://www.kivalens.org/#/search)

This project needs to be switched to Redux and Webpack.

There are two separate npm packages. One that compiles the client code and sets up a directory
watch (using gulp and browserify) and the other that runs the server (just by running cluster.js with node)

To run the project:
* In the /react directory, run "npm run kl" and leave that console running.
* In the root project directory, run "npm start" in a separate console window.
* Once the server console has finished downloading Kiva loans, go to http://localhost:5000 in a browser

There is no hot module reloading set up, so changes made to the client require that you
refresh the browser window.

