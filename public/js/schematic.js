(function (global) {

  if (typeof global.EESCHEMA === "undefined") {
    global.EESCHEMA = {};
  }


  // SchematicComponent --------------------------------------------------------

  var SchematicComponent = function () {
    this.lLine = null;
    this.uLine = null;
    this.pLine = null;
    this.name = null;
    this.reference = null;
    this.refLetters = null;
    this.refNumber = null;
    this.value = null;
    this.footprint = null;
    this.footprintLib = null;
    this.footprintName = null;
    this.fieldLines = [];
    this.fieldProps = [];
  };

  // Reads the `fieldLines` and extracts data we're interested in from them
  SchematicComponent.prototype.parseFields = function () {
    var i = 0,
        fieldCount = this.fieldLines.length,
        splitLine;

    function removeQuotes(val) {
      return val.substr(1, val.length - 2);
    }

    while (i < fieldCount) {
      splitLine = this.fieldLines[i].split(' ');

      switch (splitLine[1]) {
        case '0': // reference
          break;

        case '1': // value
          // Remove surrounding quotes
          this.value = removeQuotes(splitLine[2]);
          break;

        case '2': // footprint
          this.footprint = removeQuotes(splitLine[2]);
          this.footprintLib = this.footprint.split(':')[0];
          this.footprintName = this.footprint.split(':')[1];
          break;
      }

      this.fieldProps[i] = {
        "n": splitLine[1],
        "text": splitLine[2],
        "orientation": splitLine[3],
        "position": {
          "x": splitLine[4],
          "y": splitLine[5]
        },
        "dimension": splitLine[6],
        "flags": splitLine[8],
        "hjustify": splitLine[9],
        "vjustifyAndFontStyle": {
          "vjustify": splitLine[10][0],
          "styleItalic": splitLine[10][1],
          "styleBold": splitLine[10][2]
        }
      };

      i++;
    }
  };

  // Read a component's data from an array of plaintext lines from .sch file
  // Will return a SchematicComponent instance, or throw if unable.
  // If the component is a "Power" component, that is a power flag like
  // Vcc or whatnot, will return `null` instead.
  SchematicComponent.FromLines = function (lines) {
    var i = 0,
        len,
        comp;

    if (typeof lines === "undefined" || typeof lines.length === "undefined") {
      throw "SchematicComponent.FromLines: invalid lines; not array.";
    }

    if (lines.length === 0) {
      throw "SchematicComponent.FromLines: lines are empty";
    }

    if (lines[0] !== "$Comp") {
      throw "SchematicComponent.FromLines: does not start with '$Comp'";
    }

    len = lines.length;
    comp = new SchematicComponent();

    while (i < len) {
      (function () {
        var splitLine = lines[i].split(' ');

        switch (lines[i][0]) {
          case 'L':
            comp.lLine = lines[i];
            comp.name = splitLine[1];
            (function () {
              var parts = splitLine[2].match(/([A-|a-z]+)?(\d+|\?+)?/);
              comp.reference = splitLine[2];
              comp.refLetters = parts[1] || null;
              comp.refNumber = parts[2] || null;

              if (comp.refNumber !== null) {
                comp.refNumber = parseInt(comp.refNumber, 10);
                if (isNaN(comp.refNumber)) {
                  comp.refNumber = null;
                }
              }
            }());

            break;

          case 'U':
            comp.uLine = lines[i];
            break;

          case 'P':
            comp.pLine = lines[i];
            break;

          case 'F':
            comp.fieldLines.push(lines[i]);
            break;
        } // switch
      }()); // closure

      comp.parseFields();

      i++;
    } // while

    if (lines[i - 1] !== "$EndComp") {
      console.warn(
        "SchematicComponent.FromLines: Last line wasn't '$EndComp' but " +
        lines[i - 1]);
    }

    // Power icon or power flag, not interested.
    if (comp.reference[0] === '#') {
      return null;
    }



    return comp;
  };

  SchematicComponent.MakeCompareFunction = function () {
    // Closure in which comparing options can be stored, to be passed to
    // MakeCompareFunction as arguments

    var compare = function (first, second) {

      if (first.name < second.name) {
        return -1;
      }

      if (first.name > second.name) {
        return 1;
      }

      if (first.refLetters < second.refLetters) {
        return -1;
      }

      if (first.refLetters > second.refLetters) {
        return 1;
      }

      if (first.refNumber < second.refNumber) {
        return -1;
      }

      if (first.refNumber > second.refNumber) {
        return 1;
      }

      if (first.value < second.value) {
        return -1;
      }

      if (first.value > second.value) {
        return 1;
      }


      return 0;
    };

    return compare;
  };

  // End SchematicComponent ----------------------------------------------------

  // Schematic -----------------------------------------------------------------

  // TODO: analze components:
  // - Combine components with same reference and U n field (unit number within
  //   component)
  // - Analyze components for duplicates (where U n as well as reference is the
  //   same). Log errors for those ones, but ensure it doesn't get flagged for
  //   components missing a refNumber, as those have not been assigned yet.
  var Schematic = function(initText) {
    var originalLines = [];
    var self = this;

    this.components = [];

    (function init () {
      var lineCount,
          i = 0,
          curCompLines = null;

      originalLines = initText.match(/[^\r\n]+/g);
      lineCount = originalLines.length;

      while (i < lineCount) {
        if (originalLines[i] === "$Comp") {
          // Finish off an ongoing component
          if (curCompLines !== null) {
            // Started a new component while another one was ongoing
            // Shouldn't happen but we can recover, process what we have:
            try {
              (function () {
                var component = SchematicComponent.FromLines(curCompLines);

                if (component !== null) {
                  self.components.push(component);
                }

                curCompLines = null;
              }());
            } catch (ex) {
              console.error(ex);
            }
          } // if

          curCompLines = [];
        } // if

        // If we're currently loading up a component, line by line,
        // add this line to the component's line array
        // If we hit the end of it, create the component instance and add
        // it to the components array.
        if (curCompLines !== null) {
          curCompLines.push(originalLines[i]);

          if (originalLines[i] === "$EndComp") {
            try {
              (function () {
                var component = SchematicComponent.FromLines(curCompLines);

                if (component !== null) {
                  self.components.push(component);
                }

                curCompLines = null;
              }());
            } catch (ex) {
              console.error(ex);
            }
          } // if
        } // if

        i++;

      } // while

      console.log(
        "Schematic initialized with " + self.components.length + " components.");
      console.log(self.components);
    }());
  }

  global.EESCHEMA.SchematicComponent = SchematicComponent;
  global.EESCHEMA.Schematic = Schematic;

}(window));
