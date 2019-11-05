(function (global) {
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

  // Parse a single field line into it components
  // `line` is a raw line of text from the .sch file, from within a component,
  // starting with the character 'F'.
  function getFieldProps(line) {
    var splitLine = line.split(' ');

    return {
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
  }

  // Given a string containing quotes at the start and end, removes those quotes
  // In truth, just removes the first and last character of a string and returns
  // the result, but that is the purpose.
  function removeQuotes(val) {
    return val.substr(1, val.length - 2);
  }

  // Reads the `fieldLines` and extracts data we're interested in from them
  SchematicComponent.prototype.parseFields = function () {
    var i = 0,
        fieldCount = this.fieldLines.length,
        splitLine;

    for (i = 0; i < fieldCount; i++) {
      this.fieldProps[i] = getFieldProps(this.fieldLines[i]);

      (function (field) {
        // Extract information we know of from fieldLines for easier, named
        // access.
        switch (field.n) {
          case '0': // reference
            // Nothing to do, we already got this elsewhere.
            // Case left in for documentation purposes.
            break;

          case '1': // value
            this.value = removeQuotes(field.text);
            break;

          case '2': // footprint
            this.footprint = removeQuotes(field.text);
            this.footprintLib = this.footprint.split(':')[0];
            this.footprintName = this.footprint.split(':')[1];
            break;
        }
      }.bind(this)(this.fieldProps[i])); // Closure
    } // for
  };

  // Read a component's data from an array of plaintext lines from .sch file
  // Will return a SchematicComponent instance, or throw if unable.
  // If the component is a "Power" component, that is a power flag like
  // Vcc or whatnot, will return `null` instead.
  // TODO split up this function, it's too long.
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

          // TODO: take apart the U line to grab the units, used for analysis.
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

  // "Static"
  // Creates and returns a comparison function for array.sort, which operates
  // on schematic components, based on parameters supplied to
  // MakeCompareFunction
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

  global.EESCHEMA.SchematicComponent = SchematicComponent;
}(window));
