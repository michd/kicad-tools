(function (global) {
  var SchematicComponent = global.EESCHEMA.SchematicComponent,
      Schematic = global.EESCHEMA.Schematic,
      Dialog = global.EESCHEMA.Dialog,
      MultipleChoiceDialog = global.EESCHEMA.MultipleChoiceDialog;

  var dropTarget = document.querySelector("#drop_target");
  var fileInput = dropTarget.querySelector("input[type=file]");

  var schematicToolsSection = document.querySelector("#schematic_tools");
  var componentsSection = document.querySelector("#components");
  var problemsSection = document.querySelector("#problems");
  var actionsSection = document.querySelector("#actions");

  var problemsTableBody = problemsSection.querySelector("tbody");
  var componentsTableBody = componentsSection.querySelector("tbody");

  var saveButton = document.querySelector("#save_schematic_button");
  var annotateButton = document.querySelector("#annotate_schematic_button");

  var statusLine = document.querySelector("#status_line");

  var schematic;

  // Entry point for the full text of the file
  function processFile(text, filename) {
    // Load and process schematic file
    try {
      schematic = new Schematic(text, filename);
      dropTarget.classList.add("gone");
    } catch (ex) {
      writeErrorStatus(ex);
    }

    updateComponents();
    schematicToolsSection.classList.remove("gone");
    updateProblems(schematic.problems);
  }

  function clear(container) {
    while (container.hasChildNodes()) {
      container.removeChild(container.lastChild);
    }
  }

  function updateProblems(problems) {
    clear(problemsTableBody);

    if (problems.length === 0) {
      problemsSection.classList.add("gone");
      return;
    }

    printProblems(problems);

    if (problems.length !== 0) {
      problemsSection.classList.remove("gone");
    }
  }

  function updateComponents(compontents) {
    clear(componentsTableBody);

    var sortedComponents = schematic.getDistinctComponents()
          .sort(SchematicComponent.MakeCompareFunction());

    populateTable(sortedComponents);
  }

  function populateTable(components) {
    var i,
        cCount = components.length,
        row;

    for (i = 0; i < cCount; i++) {
      row = createComponentRow(components[i], i);
      componentsTableBody.appendChild(row);

      row = componentsTableBody.lastElementChild;

      row.dataset.componentIndex = components[i].componentIndex;

      if (components[i].hasProblem) {
        row.classList.add("has_problem");
      }
    }
  }

  function componentToString(comp) {
    var units = "ABCDEFGHIJLKMNOPQRSTUVWXYZ";

    // "Rxx Unit B (value 100k)"
    return comp.reference + " Unit " + units[comp.unitNumber - 1]
      + " (value " + comp.value + ")";
  }

  function duplicateComponentProblemToString(problem) {
    var str = "Duplicate component references: ",
        compLen = problem.components.length,
        componentStrings = problem.components.map(componentToString);

    return str +
      componentStrings.slice(0, compLen - 1).join(", ") +
      (compLen > 2 ? "," : "") + // Get that Oxford comma
      " and " + componentStrings[compLen - 1];
  }

  function problemToString(problem) {
    switch (problem.type) {

      case Schematic.PROBLEM_TYPE_DUPLICATE:
        return duplicateComponentProblemToString(problem);

      default:
        return "";
    }
  }

  function fixProblem() {
    launchDuplicateFixDialog(this);
  }

  function createProblemRow(problem) {
    var problemRowTemplate = document.querySelector("#problem_row");
    var row = document.importNode(problemRowTemplate.content, true);
    var cells = row.querySelectorAll("td");
    var fixButton = row.querySelector("button");
    cells[0].textContent = problemToString(problem);
    fixButton.addEventListener("click", fixProblem.bind(problem));
    return row;
  }

  function printProblems(problems) {
    problems.forEach(function (problem) {
      var row = createProblemRow(problem);
      problemsTableBody.appendChild(row);
    });
  }

  function createComponentRow(component) {
    var componentRowTemplate = document.querySelector("#component_row");
    var row = document.importNode(componentRowTemplate.content, true);
    var cells = row.querySelectorAll("td");
    cells[0].textContent = component.reference;
    cells[1].textContent = component.value;
    cells[2].textContent = component.componentName;
    cells[3].textContent = component.footprintName;
    return row;
  }

  // --------------------------------------------------------------------------
  function launchDuplicateFixDialog(problem) {
    var dialogContent = document.createElement("p");
    dialogContent.append(problemToString(problem));
    dialogContent.append(document.createElement("br"));
    dialogContent.append(document.createElement("br"));
    dialogContent.append("How would you like to fix this?");

    var dialog = new MultipleChoiceDialog(
      "Fix Duplicate components",
      dialogContent,
      [
        {
          "value": Schematic.DUPE_FIX_STRATEGY_INCREMENT_ALL,
          "label": "Increment each duplicate designator by one, shifting all " +
                     "components that come after"
        },
        {
          "value": Schematic.DUPE_FIX_STRATEGY_NEXT_AVAILABLE,
          "label": "Use first next available reference for duplicated " +
                     "components"
        }
      ]);


    dialog.onsubmit = function (ev) {
      if (ev.choice) {
        console.log(
          "Telling schematic to fix problem using strategy: ", ev.choice);
        schematic.fixDuplicateProblem(problem, ev.choice);
        schematic.analyzeComponents();
        updateComponents(schematic.components);
        updateProblems(schematic.problems);
      } else {
        console.log("submit event from duplicate fix dialog, but no choice.");
      }
    };

    dialog.showModal(true);
  }

  function launchAnnotateDialog() {
    var dialogContent = document.createElement("p"),
        dialog;

    dialogContent.append(
      "This action will overwrite all existing annotations.");
    dialogContent.append(document.createElement("br"));
    dialogContent.append(document.createElement("br"));
    dialogContent.append(
      "Please select a naming strategy. All naming strategies group components "
      + "by equal value. For positional ordering, use EESchema."
    );

    dialog = new MultipleChoiceDialog(
      "Annotate components",
      dialogContent,
      [
        {
          "label": "Most common value first",
          "value": Schematic.ANNOTATE_STRATEGY_MOST_COMMON_FIRST
        },
        {
          "label": "Least common value first",
          "value": Schematic.ANNOTATE_STRATEGY_LEAST_COMMON_FIRST
        },
        {
          "label": "Lowest value first",
          "value": Schematic.ANNOTATE_STRATEGY_LOWEST_VALUE_FIRST
        },
        {
          "label": "Highest value first",
          "value": Schematic.ANNOTATE_STRATEGY_HIGHEST_VALUE_FIRST
        }
      ]);

    dialog.onsubmit = function (ev) {
      if (ev.choice) {
        console.log(
          "Telling schematic to annotate using strategy: ", ev.choice);
        schematic.annotate(ev.choice);
        schematic.analyzeComponents();
        updateComponents(schematic.components);
        updateProblems(schematic.problems);
      } else {
        console.log("Submit event from annotate dialog, but no choice.");
      }
    };

    dialog.showModal(true);
  }

  // --------------------------------------------------------------------------

  function writeStatus(msg) {
    statusLine.classList.remove("error");
    statusLine.innerText = msg;
  }

  function writeErrorStatus(msg) {
    console.error(msg);
    statusLine.classList.add("error");
    statusLine.innerText = msg;
  }

  function onDragLeave() {
    dropTarget.classList.remove("dragover");
  }

  dropTarget.addEventListener("dragover", function (ev) {
    ev.preventDefault();
    dropTarget.classList.add("dragover");
  });

  dropTarget.addEventListener("dragend", onDragLeave);
  dropTarget.addEventListener("dragleave", onDragLeave);
  dropTarget.addEventListener("drop", onDragLeave);

  function readFile(f) {
    var reader = new FileReader();
    reader.onload = function (e) {
      writeStatus("Read file");
      processFile(e.target.result, f.name);
      writeStatus("Processed file");
    }

    reader.onerror = function (err) {
      writeErrorStatus("Failed to read dropped file");
    }

    reader.readAsText(f);
  }


  dropTarget.addEventListener("drop", function (e) {
    e.stopPropagation();
    e.preventDefault();
    readFile(e.dataTransfer.files[0]);
    return false;
  });

  fileInput.addEventListener("change", function (e) {
    e.stopPropagation();
    e.preventDefault();
    if (fileInput.value === "") return;
    readFile(fileInput.files[0]);
  });

  // On clicking save button, start a download a plaintext .sch file
  // This is a bit hacky, works by creating an <a> element with a href
  // containing a data uri with the full text of the file, with the download
  // attribute.
  // Seen at
  // https://ourcodeworld.com/articles/read/189/how-to-create-a-file-and-generate-a-download-with-javascript-in-the-browser-without-a-server
  saveButton.addEventListener("click", function (e) {
    var a = document.createElement("a");
    a.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," 
        + encodeURIComponent(schematic.generateFile()));
    a.setAttribute("download", schematic.originalFilename);
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  annotateButton.addEventListener("click", launchAnnotateDialog);
}(window));
