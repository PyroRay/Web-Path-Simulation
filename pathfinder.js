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
        parentWall: obstacles.length, // store which wall it came from
      });
    }
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

// <---------- Draw Everything to Canvas ---------->

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
    ctx.fillStyle =
      node === startNode ? "green" : node === goalNode ? "red" : "blue";
    ctx.beginPath();
    ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// <---------- Build Visibility Graph ---------->

function buildGraph() {
  edges.length = 0;

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
  // Define rectangle corners
  const topLeft = { x: r.x, y: r.y };
  const topRight = { x: r.x + r.width, y: r.y };
  const bottomLeft = { x: r.x, y: r.y + r.height };
  const bottomRight = { x: r.x + r.width, y: r.y + r.height };

  const edges = [
    [topLeft, topRight],
    [topLeft, bottomLeft],
    [topRight, bottomRight],
    [bottomLeft, bottomRight],
  ];

  // Check line intersection with any edge of the rectangle
  for (let [p1, p2] of edges) {
    if (lineIntersectsLine(a, b, p1, p2)) {
      // log("Edge intersect detected.");
      return true;
    }
  }

  // Additional check: does the segment pass through the rectangle's interior
  const minX = r.x;
  const maxX = r.x + r.width;
  const minY = r.y;
  const maxY = r.y + r.height;

  if (pointInRect(a, r) || pointInRect(b, r)) {
    // log("Point inside rectangle — intersection.");
    return true;
  }

  if (
    ((a.x < minX && b.x > maxX) || (b.x < minX && a.x > maxX)) &&
    ((a.y < minY && b.y > maxY) || (b.y < minY && a.y > maxY))
  ) {
    // log("Segment crosses through the rectangle's interior.");
    return true;
  }

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
function heuristic(a, b) {
  // Return the Euclidean distance
  // Works as a Admissable Heuristic as the Euclidean distance will always be <= the actual distance
  // No matter what as it is the minimum distance between two points in 2d space
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// <---------- Pathfinding Algorihtms ---------->

// Run A* Pathfinding Alrorithm on our Graph
function runAStar(startNode, goalNode) {
  // Set to represent the search frontier for A*
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
}

// Initial draw
draw();
