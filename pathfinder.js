// <---------- Canvas Setup ---------->
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// <---------- Data Structures ---------->
// List of wall rectangles
// Each obstacle contains: { x: Number, y: Number, width: Number, height: Number }
const obstacles = [];

// Key points (corners, start/goal)
// Each node contains: { x: Number, y: Number, id: Number, parentWall?: Number }
const nodes = [];

// Connections between visible nodes
// Each edge contains: { from: Node, to: Node }
const edges = [];

// Create an adjacency list out of the edges and nodes
// Each entry has key = Number (node.id), value = Array of { node: Node, weight: Number }
const graph = new Map();

// <---------- State Variables ---------->
let mode = "wall"; // Current draw mode: 'wall', 'start', or 'goal'
let startNode = null;
let goalNode = null;

let isDrawing = false; // Mouse drag tracking
let startX, startY; // Mouse start position

let nodeIdCounter = 0; // Counter to track current node number
let obstacleIdCounter = 0; // Counter to track current node number

// <---------- Debugging Features ---------->
// sends message to the log on the html page
function log(message) {
  const logPanel = document.getElementById("logPanel");
  const p = document.createElement("div");
  p.textContent = message;
  logPanel.appendChild(p);
  logPanel.scrollTop = logPanel.scrollHeight; // Auto-scroll to bottom
}

// <---------- Mouse Handlers ---------->

// Start drawing rectangle
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
  isDrawing = true;
});

// Finish drawing rectangle or place node
canvas.addEventListener("mouseup", (e) => {
  if (!isDrawing) return;
  isDrawing = false;
  const rect = canvas.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(startX - endX);
  const h = Math.abs(startY - endY);

  if (mode === "wall") {
    obstacles.push({ x, y, width: w, height: h });

    // Add all 4 corners of wall as graph nodes
    const corners = [
      { x: x, y: y },
      { x: x + w, y: y },
      { x: x, y: y + h },
      { x: x + w, y: y + h },
    ];
    for (const corner of corners) {
      nodes.push({
        ...corner,
        id: nodeIdCounter++,
        parentWall: obstacleIdCounter, // store which wall it came from
      });
    }
    obstacleIdCounter++;
    log(`Created wall at (${x}, ${y}) with width ${w} and height ${h}`);
  } else if (mode === "start" || mode === "goal") {
    // Remove old start/goal nodes if they exist
    if (mode === "start" && startNode) {
      const index = nodes.indexOf(startNode);
      if (index != -1) nodes.splice(index, 1);
    }
    if (mode === "goal" && goalNode) {
      const index = nodes.indexOf(goalNode);
      if (index != -1) nodes.splice(index, 1);
    }
    // Add the new start/goal node
    const node = { x: x + w / 2, y: y + h / 2, id: nodeIdCounter++ };
    nodes.push(node);
    if (mode === "start") {
      startNode = node;
      log(`Set start node at (${node.x.toFixed(1)}, ${node.y.toFixed(1)})`);
    }
    if (mode === "goal") {
      goalNode = node;
      log(`Set goal node at (${node.x.toFixed(1)}, ${node.y.toFixed(1)})`);
    }
  }

  draw();
});

// <---------- Keyboard Shortcuts ---------->

// Change mode or build graph
document.addEventListener("keydown", (e) => {
  if (e.key === "s") mode = "start";
  else if (e.key === "g") mode = "goal";
  else if (e.key === "w") mode = "wall";
  else if (e.key === "Enter") {
    log("Beginning building of graph");
    buildGraph();
    log("Beginning drawing");
    draw();
    log("Render complete");
  }
});

// <---------- Other Listeners ---------->

// Clear the "board" and reset all variables
document.getElementById("clearButton").addEventListener("click", () => {
  obstacles.length = 0;
  nodes.length = 0;
  edges.length = 0;
  graph.clear();
  startNode = null;
  goalNode = null;
  if (typeof nodeIdCounter !== "undefined") nodeIdCounter = 0; // if you added this earlier
  log("Cleared all obstacles, nodes, and paths.");
  draw();
});

// Do A* Algorithm
document.getElementById("beginAStar").addEventListener("click", () => {
  if (startNode && goalNode) {
    runAStar(startNode, goalNode);
  } else {
    log("Please place both a start and goal node.");
  }
});

// <---------- Draw to Canvas ---------->

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw walls
  ctx.fillStyle = "black";
  for (let obs of obstacles) {
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
  }

  // Draw visibility edges
  ctx.strokeStyle = "red";
  for (let edge of edges) {
    ctx.beginPath();
    ctx.moveTo(edge.from.x, edge.from.y);
    ctx.lineTo(edge.to.x, edge.to.y);
    ctx.stroke();
  }

  // Draw nodes
  for (let node of nodes) {
    // if this is a wall-corner (has parentWall), skip it
    if (node.parentWall !== undefined) continue;

    ctx.fillStyle =
      node === startNode ? "green" : node === goalNode ? "red" : "blue";
    ctx.beginPath();
    ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPath(path) {
  // Log the path to the debug panel
  const pathString = path
    .map((node) => `(${node.x.toFixed(1)}, ${node.y.toFixed(1)})`)
    .join(" -> ");
  log(`Path found: ${pathString}`);

  // Correct path will be lime and of width 3
  ctx.strokeStyle = "lime";
  ctx.lineWidth = 3;
  // Create the path
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  // Render the path
  ctx.stroke();
  // reset linewidth (strokeStyle is changed in every draw so should be fine)
  ctx.lineWidth = 1;
}

// <---------- Build Visibility Graph ---------->

function buildGraph() {
  edges.length = 0;
  graph.clear();

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeA = nodes[i];
      const nodeB = nodes[j];

      // Check if both nodes came from the same wall
      const sameWall =
        nodeA.parentWall !== undefined &&
        nodeB.parentWall !== undefined &&
        nodeA.parentWall === nodeB.parentWall;

      let allow = true;

      if (sameWall) {
        // Only allow edge-aligned connections (horizontal or vertical)
        const dx = Math.abs(nodeA.x - nodeB.x);
        const dy = Math.abs(nodeA.y - nodeB.y);
        const alignedHorizontally = dx > 0 && dy === 0;
        const alignedVertically = dy > 0 && dx === 0;

        if (!(alignedHorizontally || alignedVertically)) {
          allow = false; // reject diagonal same-wall connections
        }
      }

      // Check line of sight (not blocked by walls)
      if (allow && isVisible(nodeA, nodeB)) {
        edges.push({ from: nodeA, to: nodeB });
        edges.push({ from: nodeB, to: nodeA });
      }
    }
  }

  // Convert edges to an adjacency list for use by pathfinding algorithm
  for (const edge of edges) {
    const dx = edge.from.x - edge.to.x;
    const dy = edge.from.y - edge.to.y;
    const dist = Math.hypot(dx, dy); // distant will be the weight

    // Make sure each node has an initialized list of neighbours in the adjacency list
    if (!graph.has(edge.from.id)) {
      graph.set(edge.from.id, []);
    }

    // Push each node onto the adjacency list
    graph.get(edge.from.id).push({ node: edge.to, weight: dist });
  }

  log("List of nodes:");
  for (const node of nodes) {
    let type = "wall corner";
    if (node === startNode) type = "start";
    else if (node === goalNode) type = "goal";

    log(
      `Node ${node.id}: (${node.x.toFixed(1)}, ${node.y.toFixed(1)}) — ${type}`
    );
  }

  log("List of edges:");
  for (const edge of edges) {
    log(`From Node ${edge.from.id} -> Node ${edge.to.id}`);
  }

  log("Graph adjacency list:");
  for (const [nodeId, neighbors] of graph.entries()) {
    const neighborInfo = neighbors
      .map(
        (n) =>
          `-> Node ${n.node.id} (${n.node.x.toFixed(1)}, ${n.node.y.toFixed(
            1
          )}) [w=${n.weight.toFixed(1)}]`
      )
      .join(", ");
    log(`Node ${nodeId}: ${neighborInfo}`);
  }
}

// <---------- Line of Sight Checker ---------->

function isVisible(a, b) {
  for (let obs of obstacles) {
    if (lineIntersectsRect(a, b, obs)) return false;
  }
  return true;
}

// <---------- Rectangle Collision Check ---------->

function lineIntersectsRect(a, b, r) {
  // 1) Define corners and perform the edge test
  const corners = [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x, y: r.y + r.height },
    { x: r.x + r.width, y: r.y + r.height },
  ];

  const edges = [
    [corners[0], corners[1]],
    [corners[0], corners[2]],
    [corners[1], corners[3]],
    [corners[2], corners[3]],
  ];

  for (const [p1, p2] of edges) {
    if (lineIntersectsLine(a, b, p1, p2)) return true;
  }

  // 2) Test if endpoints are inside the rectangle
  if (pointInRect(a, r) || pointInRect(b, r)) return true;

  return false;
}

// <---------- Line Segment Intersection ---------->

// Checks whether two line segments a1<–>a2 and b1<–>b2) intersect
function lineIntersectsLine(a1, a2, b1, b2) {
  // Compute the determinant of the 2D cross product of direction vectors
  // This tells us if the lines are parallel (intersection impossible when parallel)
  const det = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  if (det === 0) return false;

  // Compute lambda: where on a1<–>a2 the intersection occurs (lambda between 0 and 1 => within segment)
  const lambda =
    ((b2.y - b1.y) * (b2.x - a1.x) + (b1.x - b2.x) * (b2.y - a1.y)) / det;

  // Compute gamma: where on b1<–>b2 the intersection occurs (gamma between 0 and 1 => within segment)
  const gamma =
    ((a1.y - a2.y) * (b2.x - a1.x) + (a2.x - a1.x) * (b2.y - a1.y)) / det;

  // Return true only if the intersection is strictly inside both segments (not just touching endpoints)
  return 0 < lambda && lambda < 1 && 0 < gamma && gamma < 1;
}

// <---------- Point Inside Rectangle ---------->

function pointInRect(p, r) {
  return p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
}

// <---------- Pathfinding Helpers ---------->

// Main heuristic function for A* (and potentially GBFS)
function heuristic(a, b) {
  // Return the Euclidean distance
  // Works as a Admissable Heuristic as the Euclidean distance will always be <= the actual distance
  // No matter what as it is the minimum distance between two points in 2d space
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Find the node in the frontier with the lowest cost (will change if I decide to use Priority Queue)
function getLowestEstimatecCost(frontier, estimatedTotalCost) {
  let bestNode = null;
  let bestScore = Infinity;

  for (const node of frontier) {
    const score = estimatedTotalCost.get(node.id);
    if (score < bestScore) {
      bestScore = score;
      bestNode = node;
    }
  }

  return bestNode;
}

// Reconstruct the path based on the cameFrom map and draw the path
function constructPath(cameFrom, currentNode) {
  log("Constructing Path");

  const path = [currentNode];
  // While we can still continue down the chain, we build the path step-by-step
  while (cameFrom.has(currentNode.id)) {
    log("Backtracking");
    currentNode = cameFrom.get(currentNode.id);
    path.unshift(currentNode);
  }

  drawPath(path);
}

// <---------- Pathfinding Algorihtms ---------->

// Run A* Pathfinding Alrorithm on our Graph
function runAStar(startNode, goalNode) {
  // Set to represent the search frontier for A*
  // More optimal to use a priority queue, but since this is just a small demo I'll add it later
  const frontier = new Set();
  frontier.add(startNode);

  // Map to store the previous node in the path before the node.id
  const cameFrom = new Map();

  // Cost from the startNode to the node.id
  const costFromStart = new Map();
  // Cost from the startNode to the node.id + estimated distance from node.id to the goalNode
  const estimatedTotalCost = new Map();

  // Init the nodes
  for (const node of nodes) {
    // Set costs to be infinite for reasons
    costFromStart.set(node.id, Infinity);
    estimatedTotalCost.set(node.id, Infinity);
  }
  // Cost to go from startNode to startNode is zero
  costFromStart.set(startNode.id, 0);
  // Cost to go from startNode to goalNode is simply the heuristic
  estimatedTotalCost.set(startNode.id, heuristic(startNode, goalNode));

  // Logic for A* algorithm goes here
  while (frontier.size > 0) {
    log("in while loop");
    // Find the node in the frontier with the lowest estimated cost
    const currentNode = getLowestEstimatecCost(frontier, estimatedTotalCost);

    // If we have arrived at the goal, trace the path and draw it
    if (currentNode === goalNode) {
      // Log the cameFrom map contents
      log("cameFrom map:");
      for (const [nodeId, parentNode] of cameFrom.entries()) {
        log(
          `  Node ${nodeId} <- Node ${parentNode.id} (${parentNode.x.toFixed(
            1
          )}, ${parentNode.y.toFixed(1)})`
        );
      }
      // Check to make sure goal is correct
      log(
        `Reached goal: (${currentNode.x.toFixed(1)}, ${currentNode.y.toFixed(
          1
        )})`
      );
      log(
        `Goal should be: (${goalNode.x.toFixed(1)}, ${goalNode.y.toFixed(1)})`
      );
      constructPath(cameFrom, currentNode);
      return;
    }

    // "pop" the current node from the frontier
    frontier.delete(currentNode);

    // Grab the adjancency list of the current node or set to an empty list if undefined
    const neighbours = graph.get(currentNode.id) || [];
    // Iterate through all the neighbours and find the lowest cost
    for (const neighbour of neighbours) {
      log(`Is current node the start node? ${currentNode.id === startNode.id}`);
      const tentCost = costFromStart.get(currentNode.id) + neighbour.weight;
      if (tentCost < costFromStart.get(neighbour.node.id)) {
        cameFrom.set(neighbour.node.id, currentNode);
        costFromStart.set(neighbour.node.id, tentCost);
        estimatedTotalCost.set(
          neighbour.node.id,
          tentCost + heuristic(neighbour.node, goalNode)
        );
        frontier.add(neighbour.node);
      }
    }
  }
  log("No path exists");
}

// Initial draw
draw();
