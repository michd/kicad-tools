(function (global, SchematicComponent) {

  // TODO: add in a "namespace" file as the first file, setting just this up.
  if (typeof global.EESCHEMA === "undefined") {
    global.EESCHEMA = {};
  }

  // TODO: analze components:
  // - Combine components with same reference and U n field (unit number within
  //   component)
  // - Analyze components for duplicates (where U n as well as reference is the
  //   same). Log errors for those ones, but ensure it doesn't get flagged for
  //   components missing a refNumber, as those have not been assigned yet.
  var Schematic = function(initText) {
    var originalLines = initText.match(/[^\r\n]+/g);
    var self = this; // Yeah binding and all. Or just, this one.

    this.components = [];

    getComponentsFromLines();

    console.log(
      "Schematic initialized with " + this.components.length + " components.");
    console.log(this.components);

    function buildAndAddComponent(componentLines) {
      var component;

      try {
        component = SchematicComponent.FromLines(componentLines);

        if (component !== null) {
          self.components.push(component);
        }

        curCompLines = null;
      } catch (ex) {
        console.error(ex);
      }
    }

    // Iterates over all the lines and looks for strings that start and end
    // components. Collects the lines including start and end into a component
    // lines array, and then delegates to SchematicComponent.FromLines to
    // read the data contained in those lines into a structured object.
    function getComponentsFromLines() {
      var lineCount = originalLines.length,
          i = 0,
          curCompLines = null;

      while (i < lineCount) {
        // If the current line starts a component,
        // first check if we had an ongoing component. If so, finish adding it,
        // even though it indicates a malformed file.
        // In either case, start a blank array for component lines.
        if (originalLines[i] === "$Comp") {
          // Finish off an ongoing component
          if (curCompLines !== null) {
            // Started a new component while another one was ongoing
            // Shouldn't happen but we can recover, process what we have:
            buildAndAddComponent(curCompLines);
            curCompLines = null;
          }

          curCompLines = [];
        }

        // If we're currently loading up a component, line by line,
        // add this line to the component's line array.
        // If we hit the end of it, create the component instance and add
        // it to the components array.
        if (curCompLines !== null) {
          curCompLines.push(originalLines[i]);

          if (originalLines[i] === "$EndComp") {
            buildAndAddComponent(curCompLines);
            curCompLines = null;
          }
        }

        i++;
      } // while
    } // function
  }; // Schematic

  global.EESCHEMA.Schematic = Schematic;
}(window, window.EESCHEMA.SchematicComponent));
