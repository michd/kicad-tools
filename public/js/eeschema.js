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

  var statusLine = document.querySelector("#status_line");

  var schematic;

  // Entry point for the full text of the file
  function processFile(text) {
    // Load and process schematic file
    try {
      schematic = new Schematic(text);
      dropTarget.classList.add("gone");
    } catch (ex) {
      writeErrorStatus(ex);
    }

    var sortedComponents = schematic.getDistinctComponents()
          .sort(SchematicComponent.MakeCompareFunction());

    populateTable(sortedComponents);
    schematicToolsSection.classList.remove("gone");

    if (schematic.problems.length > 0) {
      printProblems(schematic.problems);
      problemsSection.classList.remove("gone");
    }
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

      case "duplicateComponent":
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
    cells[0].textContent = problemToString(problem);;
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
          "value": "increment_all",
          "label": "Increment each duplicate designator by one, shifting all " +
                     "components that come after"
        },
        {
          "value": "next_available",
          "label": "Use first next available reference for duplicated " +
                     "components"
        }
      ]);


    dialog.onsubmit = function (ev) {
      console.log("submit event from dialog, data:", ev);
    };

    dialog.oncancel = function (ev) {
      console.log("Cancel event from dialog");
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
      processFile(e.target.result);
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
    a.setAttribute("download", "schematic.sch"); // TODO get orig filename?
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}(window));
