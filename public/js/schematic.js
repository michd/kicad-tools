(function (global, SchematicComponent) {
  var Schematic = function(initText, filename) {
    var self = this; // Yeah binding and all. Or just, this one.
    this.originalFilename = filename;
    this.originalText = initText;
    this.originalLines = initText.match(/[^\r\n]+/g);
    this.problems = [];
    this.components = [];

    // TODO: verify file header (make sure it starts in
    // "EESchema Schematic File Version \d"), throwing otherwise

    getComponentsFromLines();
    this.analyzeComponents();

    console.log(
      "Schematic initialized with " + this.components.length + " components.");
    console.log(this.components);

    function buildAndAddComponent(componentLines) {
      var component;

      try {
        component = SchematicComponent.FromLines(componentLines);

        if (component !== null) {
          self.components.push(component);
          component.componentIndex = self.components.length - 1;
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
      var curCompLines = null;

      self.originalLines.forEach(function (line) {
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

  function fixDupeIncrementAll(problem) {
    reserveReferences.bind(this)(
      problem.components[0].refLetters,
      problem.components[0].refNumber + 1,
      problem.components.length - 1);

    problem.components.forEach(function (c, i) {
      c.refNumber += i;
      c.reference = c.refLetters + c.refNumber.toString(10);
      c.hasProblem = false;
    });
  }

  function fixDupeNextAvailable(problem) {
    problem.components.slice(1).forEach(function (c) {
      var newRef = findNextAvailableRef.bind(this)(c.reference);
      c.reference = newRef.reference;
      c.refNumber = newRef.refNumber;
    }.bind(this));

    problem.components.forEach(function (c) { c.hasProblem = false; });
  }

  // Gets the next available reference and returns it as an object that
  // SchematicComponent.ParseReference would return
  function findNextAvailableRef(refStr) {
    var parsedRef = SchematicComponent.ParseReference(refStr),
        comps,
        potentialNumber = parsedRef.refNumber + 1;

    comps = this.components.filter(function (c) {
      return c.refLetters === parsedRef.refLetters
              && c.refNumber !== null
              && c.refNumber >= parsedRef.refNumber;
    });

    function refTaken(n) {
      return comps.some(function (c) {
        return c.refNumber === n;
      });
    }

    // Increment potential ref number until we find one that doesn't match
    while (refTaken(potentialNumber)) potentialNumber++;

    return {
      "reference": parsedRef.refLetters + potentialNumber.toString(10),
      "refLetters": parsedRef.refLetters,
      "refNumber": potentialNumber
    };
  }

  function reserveReferences(refLetters, startN, count) {
    var comps;
    count = (typeof count === "number") ? count : 1;
    count = count > 0 ? count : 1;

    comps = this.components.filter(function (c) {
      return c.refLetters === refLetters
              && c.refNumber !== null
              && c.refNumber >= startN;
    });

    comps.forEach(function (c) {
      c.refNumber += count;
      c.reference = c.refLetters + c.refNumber.toString(10);
    });
  }

  function addDuplicateProblem(dupes) {
    this.problems.push({
      "type": "duplicateComponent",
      "components": dupes
    });
  }

  Schematic.prototype.analyzeComponents = function () {
    var distinctComponentUnits = [],
        dupeGroups = [];

    this.problems = [];

    this.components.forEach(function(curComp) {
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

    dupeGroups.forEach(addDuplicateProblem.bind(this));
  };


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

  Schematic.prototype.fixDuplicateProblem = function (problem, strategy) {
    switch (strategy) {
      case Schematic.DUPE_FIX_STRATEGY_INCREMENT_ALL:
        fixDupeIncrementAll.bind(this)(problem);
        break;

      case Schematic.DUPE_FIX_STRATEGY_NEXT_AVAILABLE:
        fixDupeNextAvailable.bind(this)(problem);
        break;
    }
  };

  Schematic.prototype.generateFile = function () {
    var lines = [],
        // TODO: detect line ending from original text, and re-use that.
        newline = "\n",
        compIndex = 0,
        compLines = [],
        inComponent = false;

    // Iterate over original lines
    this.originalLines.forEach(function (l) {
      if (!inComponent && l !== "$Comp") {
        lines.push(l);
      } else {
        if (l === "$Comp") {
          inComponent = true;
          compLines = [l];
        } else {
          compLines.push(l);

          if (l === "$EndComp") {
            // Component ended, try converting it to a SchematicComponent.
            // This will return null if it's a pseudo component like a power
            // flag.
            if (SchematicComponent.FromLines(compLines) !== null) {
              // If it's a component we're interested in,
              // convert the matching (by index) potentially edited component
              // to lines to replace the existing lines
              lines = lines.concat(this.components[compIndex].buildLines());

              // Increment component index indicating number of components
              // we've replaced from the array.
              compIndex++; 
            } else {
              // If it's a component we don't care about, copy in its lines
              // as we found them.
              lines = lines.concat(compLines);
            }

            inComponent = false;
            compLines = [];
          }
        }
      }
    }.bind(this));

    return lines.join(newline);
  };

  Schematic.DUPE_FIX_STRATEGY_INCREMENT_ALL = "increment_all";
  Schematic.DUPE_FIX_STRATEGY_NEXT_AVAILABLE = "next_available";

  global.EESCHEMA.Schematic = Schematic;
}(window, window.EESCHEMA.SchematicComponent));
