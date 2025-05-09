// <---------- Canvas Setup ---------->
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// <---------- Data Structures ---------->
const obstacles = []; // List of wall rectangles
const nodes = []; // Key points (corners, start/goal)
const edges = []; // Connections between visible nodes

// <---------- State Variables ---------->
let mode = "wall"; // Current draw mode: 'wall', 'start', or 'goal'
let startNode = null;
let goalNode = null;

let isDrawing = false; // Mouse drag tracking
let startX, startY; // Mouse start position

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
        id: nodes.length,
        parentWall: obstacles.length, // store which wall it came from
      });
    }
  } else if (mode === "start" || mode === "goal") {
    const node = { x: x + w / 2, y: y + h / 2, id: nodes.length };
    nodes.push(node);
    if (mode === "start") startNode = node;
    if (mode === "goal") goalNode = node;
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
    console.log("Beginning building of graph");
    buildGraph();
    console.log("Beginning drawing");
    draw();
  }
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
      console.log("Edge intersect detected.");
      return true;
    }
  }

  // Additional check: does the segment pass through the rectangle's interior
  const minX = r.x;
  const maxX = r.x + r.width;
  const minY = r.y;
  const maxY = r.y + r.height;

  if (pointInRect(a, r) || pointInRect(b, r)) {
    console.log("Point inside rectangle — intersection.");
    return true;
  }

  if (
    ((a.x < minX && b.x > maxX) || (b.x < minX && a.x > maxX)) &&
    ((a.y < minY && b.y > maxY) || (b.y < minY && a.y > maxY))
  ) {
    console.log("Segment crosses through the rectangle's interior.");
    return true;
  }

  return false;
}

// <---------- Line Segment Intersection ---------->

function lineIntersectsLine(a1, a2, b1, b2) {
  const det = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  if (det === 0) return false; // lines are parallel

  const lambda =
    ((b2.y - b1.y) * (b2.x - a1.x) + (b1.x - b2.x) * (b2.y - a1.y)) / det;
  const gamma =
    ((a1.y - a2.y) * (b2.x - a1.x) + (a2.x - a1.x) * (b2.y - a1.y)) / det;

  return 0 < lambda && lambda < 1 && 0 < gamma && gamma < 1;
}

// <---------- Point Inside Rectangle ---------->

function pointInRect(p, r) {
  return p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
}

// Initial draw
draw();
