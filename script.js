const graphQL = "https://01.kood.tech/api/graphql-engine/v1/graphql/";
let login = "Jserva";
let skillObj = {};
let paths = [];
let avgGrade = 0;
let gradeCount = 0;
const loading = document.querySelector("#loading");
const spinner = document.querySelector(".spinner");

const checkID = `
    query ($login: String) {
        user(
            where: {login: {_eq: $login}},
        ) {
        id
        }
    }
`;

const skills = `
    query ($login: String, $offset: Int) {
        transaction(
            where: {
            user: {login: {_eq: $login}}, 
            type: {_regex: "skill"}
            },
            order_by: {amount: desc},
            limit: 50,
            offset: $offset
        ) {
            amount
            type
        }
    }
`;

const queryTaskPaths = `
query ($login: String, $offset: Int) {
    progress(
        where: {
            user: {login: {_eq: $login}}, 
            path: {_regex: "^\/johvi\/div-01\/[-\\\\w]+$"}
          isDone: {_eq: true}
        },
      limit:50,
      offset: $offset
      order_by: {updatedAt:desc}
    ) {
        path
    	results{
            grade
        }
    }
}
`;

const taskXP = `
query ($login: String, $path: String) {
    transaction(
        where: {
            user: {login: {_eq: $login}}, 
            path: {_eq: $path}
            type: {_eq:"xp"}
        },
        order_by: {amount: desc_nulls_last},
    ) {
    	amount
        path
    }
}
`;

async function fetchQL(query, variables) {
  return fetch(graphQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: query,
      variables: variables,
    }),
  }).then((res) => {
    if (res.ok) {
      return res.json();
    } else {
      throw new Error("Network response was not ok.");
    }
  });
}

async function fetchPaths(offset) {
  return fetchQL(queryTaskPaths, { login: login, offset: offset })
    .then((data) => {
      let progresses = data.data.progress;

      progresses.forEach((progress) => {
        avgGrade += progress.results[0].grade;
        gradeCount++;
        paths.push(progress.path);
      });
      if (progresses.length === 0) {
        return [paths, Math.round(avgGrade / gradeCount)];
      } else {
        return fetchPaths(offset + 50);
      }
    })
    .catch((error) => console.error("Error:", error));
}

let totalXP = 0;
async function fetchXP(paths) {
  let totalXP = 0;
  let tasksAndXP = {};
  for (let path of paths) {
    let data = await fetchQL(taskXP, { login: login, path: path });
    let { transaction } = data.data;
    if (transaction.length > 0) {
      let taskName = transaction[0].path.slice(
        transaction[0].path.lastIndexOf("/") + 1
      );
      tasksAndXP[taskName] = transaction[0].amount;
      transaction.forEach((t) => {
        totalXP += t.amount;
      });
    }
  }

  return [totalXP, tasksAndXP];
}

async function fetchTransactions(offset) {
  return fetchQL(skills, { login: login, offset: offset })
    .then((data) => {
      let transactions = data.data.transaction;
      transactions.forEach((skill) => {
        if (!skillObj[skill.type]) {
          skillObj[skill.type] = skill.amount;
        }
      });
      if (transactions.length === 50) {
        return fetchTransactions(offset + 50);
      } else {
        return skillObj;
      }
    })
    .catch((error) => console.error("Error:", error));
}

async function displayData() {
  showLoadingOverlay();
  let findID = await fetchQL(checkID, { login: login });

  if (findID.data.user.length === 0) {
    removeLoadingOverlay();
    addInfo(
      "User not found",
      "User not found",
      "User not found",
      "User not found"
    );
    document.querySelector("#skills-chart").innerHTML = "";
    document.querySelector("#projects-chart").innerHTML = "";

    return;
  }

  let skills = await fetchTransactions(0);
  let [paths, avg] = await fetchPaths(0);
  let xpAndTasks = await fetchXP(paths);
  let level = 0;
  let totXP = xpAndTasks[0];
  let tasksXP = xpAndTasks[1];
  while (Math.round(level * (176 + 3 * level * (47 + 11 * level))) < totXP) {
    level++;
  }
  level--;

  addInfo(login, level, totXP, avg);

  addSkillsChart(skills);
  addProjectsChart(tasksXP);

  removeLoadingOverlay();
}

displayData();
addLoadingOverlay();

function addLoadingOverlay() {
  const overlay = document.createElement("div");
  const spin = document.createElement("div");
  overlay.setAttribute("id", "loading");
  spin.setAttribute("class", "spinner");
  overlay.appendChild(spin);
  document.body.appendChild(overlay);
}

function showLoadingOverlay() {
  d3.select("#loading").style("display", "flex");
}

function removeLoadingOverlay() {
  d3.select("#loading").style("display", "none");
}

let btn = document.querySelector("button");
btn.addEventListener("click", () => {
  const inp = document.querySelector("input");
  login = inp.value;
  skillObj = {};
  paths = [];
  avgGrade = 0;
  gradeCount = 0;
  displayData();
});

function addInfo(login, level, XP, avg) {
  document.querySelector("#username").textContent = login;
  document.querySelector("#level").textContent = level;
  document.querySelector("#xp").textContent = XP;
  document.querySelector("#avg").textContent = avg;
}

function addSkillsChart(data) {
  const width = 400;
  const height = 300;
  document.querySelector("#skills-chart").innerHTML = "";

  // Create the SVG element
  const svg = d3
    .select("#skills-chart")
    .attr("width", width)
    .attr("height", height);

  // Define the data
  const dataArray = Object.entries(data).map(([skill, value]) => ({
    skill,
    value,
  }));

  // Define the scales
  const xScale = d3
    .scaleLinear()
    .domain([0, d3.max(dataArray, (d) => d.value)])
    .range([0, width - 100]);

  const yScale = d3
    .scaleBand()
    .domain(dataArray.map((d) => d.skill))
    .range([0, height - 50])
    .padding(0.1);

  // Create the bars
  svg
    .selectAll("rect")
    .data(dataArray)
    .enter()
    .append("rect")
    .attr("x", 100)
    .attr("y", (d) => yScale(d.skill))
    .attr("width", (d) => xScale(d.value))
    .attr("height", yScale.bandwidth())
    .attr("fill", "#69b3a2");

  svg
    .append("text")
    .attr("transform", `translate(${width / 10}, ${height - 30})`)
    .attr("text-anchor", "middle")
    .text("Percentage")
    .attr("font-weight", "bold")
    .attr("font-size", "16px");

  // Create the axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3.axisLeft(yScale);

  svg.append("g").attr("transform", "translate(100, 250)").call(xAxis);

  svg.append("g").attr("transform", "translate(100, 0)").call(yAxis);
}

function addProjectsChart(data) {
  document.querySelector("#projects-chart").innerHTML = "";
  data = Object.entries(data).reduce((acc, [key, value]) => {
    acc[key] = Math.round(value / 1000);
    return acc;
  }, {});

  const width = 600;
  const height = 500;
  const margin = { top: 50, right: 50, bottom: 100, left: 100 };

  // Create the SVG element
  const svg = d3
    .select("#projects-chart")
    .attr("width", width)
    .attr("height", height);

  // Define the data
  const dataArray = Object.entries(data).map(([skill, value]) => ({
    skill,
    value,
  }));

  // Define the scales
  const xScale = d3
    .scaleBand()
    .domain(dataArray.map((d) => d.skill))
    .range([margin.left, width - margin.right])
    .padding(0.1);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(dataArray, (d) => d.value)])
    .range([height - margin.bottom, margin.top]);

  // Create the bars
  svg
    .selectAll("rect")
    .data(dataArray)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.skill))
    .attr("y", (d) => yScale(d.value))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - margin.bottom - yScale(d.value))
    .attr("fill", "#69b3a2");

  // Create the axes
  const xAxis = d3
    .axisBottom(xScale)
    .tickFormat((d) => d.replace(/_/g, " ").toUpperCase())
    .tickSizeOuter(0);

  const yAxis = d3.axisLeft(yScale).ticks(15).tickSizeOuter(0);

  svg
    .append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(xAxis)
    .selectAll("text")
    .attr("text-anchor", "end")
    .attr("transform", "rotate(-90) translate(-10,-10)");

  svg.append("g").attr("transform", `translate(${margin.left}, 0)`).call(yAxis);

  svg
    .append("text")
    .attr("transform", `translate(20, ${height / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .text("XP in kB")
    .attr("font-weight", "bold")
    .attr("font-size", "16px");
}
