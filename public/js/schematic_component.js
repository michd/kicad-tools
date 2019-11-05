(function (global) {
  var SchematicComponent = function () {
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

  // Takes apart a component's reference into the letter portion and the
  // numeric portion, accounting for references that may still end in '?'.
  function processComponentReference(comp) {
    var parts = comp.reference.match(/([A-Za-z]+)?(\d+|\?+)?/);
    comp.refLetters = parts[1] || null;
    comp.refNumber = parts[2] || null;

    if (comp.refNumber !== null) {
      comp.refNumber = parseInt(comp.refNumber, 10);

      // If we couldn't parse it, we don't have a number as part of the ref;
      // standardise to null.
      if (isNaN(comp.refNumber)) {
        comp.refNumber = null;
      }
    }
  }

  // Processes a single schematic file component line, assigning the data
  // contained therein to relevant component fields
  function processComponentLine(comp, line) {
    var splitLine = line.split(' ');

    switch (line[0]) {
      case 'L':
        comp.lLine = line;
        comp.name = splitLine[1];
        comp.componentLib = comp.name.split(':')[0];
        comp.componentName = comp.name.split(':')[1];
        comp.reference = splitLine[2];
        processComponentReference(comp);
        break;

      // TODO: take apart the U line to grab the units, used for analysis.
      case 'U':
        comp.uLine = line;
        break;

      case 'P':
        comp.pLine = line;
        break;

      case 'F':
        comp.fieldLines.push(line);
        break;
    }
  }

  // Reads the `fieldLines` and extracts data we're interested in from them
  function processComponentFields(comp) {
    var i = 0,
        fieldCount = comp.fieldLines.length;

    for (i = 0; i < fieldCount; i++) {
      comp.fieldProps[i] = getFieldProps(comp.fieldLines[i]);

      (function (field) {
        // Extract information we know of from fieldLines for easier, named
        // access.
        switch (field.n) {
          case '0': // reference
            // Nothing to do, we already got this elsewhere.
            // Case left in for documentation purposes.
            break;

          case '1': // value
            comp.value = removeQuotes(field.text);
            break;

          case '2': // footprint
            comp.footprint = removeQuotes(field.text);
            comp.footprintLib = comp.footprint.split(':')[0];
            comp.footprintName = comp.footprint.split(':')[1];
            break;
        }
      }(comp.fieldProps[i]));
    }
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
    var i, lineCount,
        comp;

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

    lineCount = lines.length;
    comp = new SchematicComponent();

    for (i = 0; i < lineCount; i++) {
      processComponentLine(comp, lines[i]);
    }

    if (isIrrelevantComponent(comp)) {
      return null;
    }

    processComponentFields(comp);

    if (lines[i - 1] !== "$EndComp") {
      console.warn(
        "SchematicComponent.FromLines: Last line wasn't '$EndComp' but " +
        lines[i - 1]);
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

  global.EESCHEMA.SchematicComponent = SchematicComponent;
}(window));
