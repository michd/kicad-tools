(function (global, SchematicComponent) {
  var Schematic = function(initText) {
    var originalLines = initText.match(/[^\r\n]+/g);
    var self = this; // Yeah binding and all. Or just, this one.

    this.originalText = initText;
    this.problems = [];
    this.components = [];

    // TODO: verify file header (make sure it starts in
    // "EESchema Schematic File Version \d"), throwing otherwise

    getComponentsFromLines();
    analyzeComponents();

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

    function addDuplicateProblem(dupes) {
      self.problems.push({
        "type": "duplicateComponent",
        "components": dupes
      });
    }

    // Iterates over all the lines and looks for strings that start and end
    // components. Collects the lines including start and end into a component
    // lines array, and then delegates to SchematicComponent.FromLines to
    // read the data contained in those lines into a structured object.
    function getComponentsFromLines() {
      var curCompLines = null;

      originalLines.forEach(function (line) {
        // If the current line starts a component,
        // first check if we had an ongoing component. If so, finish adding it,
        // even though it indicates a malformed file.
        // In either case, start a blank array for component lines.
        if (line === "$Comp") {
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
          curCompLines.push(line);

          if (line === "$EndComp") {
            buildAndAddComponent(curCompLines);
            curCompLines = null;
          }
        }
      });
    } // function

    function analyzeComponents() {
      var distinctComponentUnits = [],
          dupeGroups = [];

      self.components.forEach(function(curComp) {
        var dupeGroup;

        var match = distinctComponentUnits.find(function (c) {
          return componentUnitMatches(c, curComp);
        });

        if (!match) {
          distinctComponentUnits.push(curComp);
          return;
        }

        // Found a dupe!
        match.hasProblem = true;
        curComp.hasProblem = true;

        dupeGroup = dupeGroups.find(function (grp) {
          return componentUnitMatches(grp[0], curComp);
        });

        if (typeof dupeGroup === "undefined") {
          dupeGroup = [match];
          dupeGroups.push(dupeGroup);
        }

        dupeGroup.push(curComp);
      });

      dupeGroups.forEach(addDuplicateProblem);;
    }

  }; // Schematic

  function componentMatches(a, b) {
    if (!a.hasDesignator() || !b.hasDesignator()) {
      return false;
    }

    return a.reference === b.reference && a.unitNumber !== b.unitNumber;
  }

  function componentUnitMatches(a, b) {
    if (!a.hasDesignator() || !b.hasDesignator()) {
      return false;
    }

    return a.reference === b.reference && a.unitNumber === b.unitNumber;
  }

  // Returns all the distinct components, that is, filtering out duplicate
  // components for different units within the same device
  // e.g. opamps, logic gates, ...
  Schematic.prototype.getDistinctComponents = function () {
    var filteredComponents = [];

    this.components.forEach(function(curComp) {
      if (!filteredComponents.some(function (comp) {
            return componentMatches(comp, curComp); })) {
        filteredComponents.push(curComp);
      }
    });

    return filteredComponents;
  };

  // Builds a string to be served as a schematic file
  // TODO: actually regenerate the the schematic from dynamic data
  // rather than re-assembling original lines.
  // Current implementation is just to establish saving a file from the page
  // works as expected.
  Schematic.prototype.generateFile = function () {
    return this.originalText;
  };

  global.EESCHEMA.Schematic = Schematic;
}(window, window.EESCHEMA.SchematicComponent));
