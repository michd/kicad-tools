(function (global) {
  var SchematicComponent = function () {
    this.componentIndex = null;
    this.lLine = null;
    this.uLine = null;
    this.pLine = null;
    this.name = null;
    this.componentLib = null;
    this.componentName = null;
    this.reference = null;
    this.refLetters = null;
    this.refNumber = null;
    this.value = null;
    this.numericValue = null;
    this.footprint = null;
    this.footprintLib = null;
    this.footprintName = null;
    this.unitNumber = null;
    this.unitTimestamp = null;
    this.fieldLines = [];
    this.fieldProps = [];
    this.additionalLines = [];
    this.hasProblem = false;
  };

  SchematicComponent.prototype.hasDesignator = function () {
    return this.refNumber !== null;
  };

  SchematicComponent.prototype.buildLines = function () {
    var lines = [];

    this.lLine = buildLLine.bind(this)();

    lines.push("$Comp");
    lines.push(this.lLine);
    lines.push(this.uLine);
    lines.push(this.pLine);

    this.fieldLines = buildFLines.bind(this)();

    lines = lines.concat(this.fieldLines, this.additionalLines);

    lines.push("$EndComp");

    return lines;
  };

  function buildLLine() {
    return "L " +
      this.componentLib + ":" + this.componentName + " " +
      this.reference;
  }

  function buildFLines() {
    var fLines = [],
        comp = this;

    this.fieldProps.forEach(function (fp) {
      var line;

      if (fp.n === '0') {
        fp.text = comp.reference;
      }

      line = [
        "F",
        fp.n,
        addQuotes(fp.text),
        fp.orientation,
        fp.position.x,
        fp.position.y,
        fp.dimension,
        "", // Additional space for some reason
        fp.flags,
        fp.hjustify,
        [
          fp.vjustifyAndFontStyle.vjustify,
          fp.vjustifyAndFontStyle.styleItalic,
          fp.vjustifyAndFontStyle.styleBold
        ].join('')
      ].join(' ');

      fLines.push(line);
    });

    return fLines;
  }

  // Parse a single field line into it components
  // `line` is a raw line of text from the .sch file, from within a component,
  // starting with the character 'F'.
  function getFieldProps(line) {
    var splitLine = line.split(' ');

    return {
        "n": splitLine[1],
        "text": removeQuotes(splitLine[2]),
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

  function addQuotes(val) {
    return '"' + val + '"';
  }

  // Takes apart a component's reference into the letter portion and the
  // numeric portion, accounting for references that may still end in '?'.
  function processComponentReference(comp) {
    var parsedRef = SchematicComponent.ParseReference(comp.reference);

    comp.refLetters = parsedRef.refLetters;
    comp.refNumber = parsedRef.refNumber;
  }

  // Processes a single schematic file component line, assigning the data
  // contained therein to relevant component fields
  function processComponentLine(comp, line) {
    var splitLine = line.split(' ');

    if (line === "$Comp" || line === "$EndComp") return;

    switch (line[0]) {
      case 'L':
        comp.lLine = line;
        comp.name = splitLine[1];
        comp.componentLib = comp.name.split(':')[0];
        comp.componentName = comp.name.split(':')[1];
        comp.reference = splitLine[2];
        processComponentReference(comp);
        break;

      case 'U':
        comp.uLine = line;
        comp.unitNumber = comp.uLine.split(' ')[1];
        comp.unitTimestamp = comp.uLine.split(' ')[3];
        break;

      case 'P':
        comp.pLine = line;
        break;

      case 'F':
        comp.fieldLines.push(line);
        break;

      default:
        comp.additionalLines.push(line);
    }
  }

  // Reads the `fieldLines` and extracts data we're interested in from them
  function processComponentFields(comp) {
    comp.fieldProps = comp.fieldLines.map(getFieldProps);

    comp.fieldProps.forEach(function(field) {
      // Extract information we know of from fieldLines for easier, named
      // access.
      switch (field.n) {
        case '0': // reference
          // Nothing to do, we already got this elsewhere.
          // Case left in for documentation purposes.
          break;

        case '1': // value
          comp.value = field.text;
          comp.numericValue = SchematicComponent.ValueToNumber(comp.value);
          break;

        case '2': // footprint
          comp.footprint = removeQuotes(field.text);
          comp.footprintLib = comp.footprint.split(':')[0];
          comp.footprintName = comp.footprint.split(':')[1];
          break;
      }
    });
  }

  // Power flags start with # and aren't really components we care about,
  // so this function filters them out.
  function isIrrelevantComponent(component) {
    return component.reference[0] === '#';
  }

  // Read a component's data from an array of plaintext lines from .sch file
  // Will return a SchematicComponent instance, or throw if unable.
  // If the component is a "Power" component, that is a power flag like
  // Vcc or whatnot, will return `null` instead.
  SchematicComponent.FromLines = function (lines) {
    var comp;

    // Verify data type coming in before we attempt processing
    if (typeof lines === "undefined" || typeof lines.length === "undefined") {
      throw "SchematicComponent.FromLines: invalid lines; not array.";
    }

    if (lines.length === 0) {
      throw "SchematicComponent.FromLines: lines are empty";
    }

    if (lines[0] !== "$Comp") {
      throw "SchematicComponent.FromLines: does not start with '$Comp'";
    }

    comp = new SchematicComponent();

    lines.forEach(function (line) {
      processComponentLine(comp, line);
    });

    if (isIrrelevantComponent(comp)) {
      return null;
    }

    processComponentFields(comp);

    if (lines[lines.length - 1] !== "$EndComp") {
      console.warn(
        "SchematicComponent.FromLines: Last line wasn't '$EndComp' but " +
        lines[lines.length - 1]);
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

    var compare = function (a, b) {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      if (a.refLetters < b.refLetters) return -1;
      if (a.refLetters > b.refLetters) return 1;
      if (a.refNumber < b.refNumber) return -1;
      if (a.refNumber > b.refNumber) return 1;
      if (a.value < b.value) return -1;
      if (a.value > b.value) return 1;

      return 0;
    };

    return compare;
  };

  // Splits a string component reference into its letter(s) and number
  // Returns an object containing "reference", "refLetters", and "refNumber".
  // "reference" is the original reference as in refStr,
  // "refLetters" is the letters portion of it,
  // "refNumber" is the numeric portion parsed as an int, and can be null if no
  //  number was specified (or it was '?')
  SchematicComponent.ParseReference = function (refStr) {
    var parts = refStr.match(/([A-Za-z]+)?(\d+|\?+)?/),
        ref = {
          "reference": refStr,
          "refLetters": parts[1] || null,
          "refNumber": parts[2] || null
        };

    if (ref.refNumber !== null) {
      ref.refNumber = parseInt(ref.refNumber, 10);

      // If we couldn't parse it, we don't have a number as part of the ref;
      // standardise to null.
      if (isNaN(ref.refNumber)) {
        ref.refNumber = null;
      }
    }

    return ref;
  };

  SchematicComponent.ValueToNumber = function (strVal) {
    // That character class are all SI prefixes
    // (except those for deci, centi, deca, hecto, as they're not really used
    // in electronics)
    // for micro (μ), 'u' is also included as it's often used instead.
    var matches = strVal.match(/^\s*(\d+)\s*([yzafpnμumkMGTPEZY])?.*/),
        multipliers = {
          'y': 1e-24,
          'z': 1e-21,
          'a': 1e-18,
          'f': 1e-15,
          'p': 1e-12,
          'n': 1e-9,
          'u': 1e-6,
          'μ': 1e-6,
          'm': 1e-3,
          'k': 1e3,
          'M': 1e6,
          'G': 1e9,
          'T': 1e12,
          'P': 1e15,
          'E': 1e18,
          'Z': 1e21,
          'Y': 1e24,
          '1': 1 // Fallback
        };

    if (matches === null) return null;

    return parseInt(matches[1], 10) * (multipliers[matches[2] || '1']);
  };

  global.EESCHEMA.SchematicComponent = SchematicComponent;
}(window));
