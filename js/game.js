const canvas = document.getElementById("canvas1");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const collisionCanvas = document.getElementById("collisionCanvas");
const collisionCtx = collisionCanvas.getContext("2d");
collisionCanvas.width = window.innerWidth;
collisionCanvas.height = window.innerHeight;

let score = 0;
let gameOver = false;
ctx.font = "50px Impact";

let timeToNextHawk = 0;
let hawkInterval = 800;
let lastTime = 0;

let hawks = [];
class Hawk {
  constructor() {
    this.spriteWidth = 48;
    this.spriteHeight = 48;
    this.sizeModifier = Math.random() * 0.6 + 0.4;
    this.width = 144 * this.sizeModifier;
    this.height = 144 * this.sizeModifier;
    this.x = canvas.width;
    this.y = Math.random() * (canvas.height - this.height);
    this.directionX = Math.random() * 5 + 3;
    this.directionY = Math.random() * 5 - 2.5;
    this.markedForDeletion = false;
    this.image = new Image();
    this.image.src = "./img/RoboHawk.png";
    this.frame = 0;
    this.maxFrame = 2;
    this.timeSinceFlap = 0;
    this.flapInterval = Math.random() * 50 + 50;
    this.randomColors = [
      Math.floor(Math.random() * 254) + 1,
      Math.floor(Math.random() * 255),
      Math.floor(Math.random() * 255),
    ];
    this.color =
      "rgb(" +
      this.randomColors[0] +
      "," +
      this.randomColors[1] +
      "," +
      this.randomColors[2] +
      ")";
  }
  update(deltaTime) {
    if (this.y < 0 || this.y > canvas.height - this.height) {
      this.directionY = this.directionY * -1;
    }
    this.x -= this.directionX;
    this.y += this.directionY;
    if (this.x < 0 - this.width) this.markedForDeletion = true;
    this.timeSinceFlap += deltaTime;
    if (this.timeSinceFlap > this.flapInterval) {
      if (this.frame > this.maxFrame) this.frame = 0;
      else this.frame++;
      this.timeSinceFlap = 0;
    }
    if (this.x < 0 - this.width) gameOver = true;
  }
  draw() {
    collisionCtx.fillStyle = this.color;
    collisionCtx.fillRect(this.x, this.y, this.width, this.height);
    ctx.drawImage(
      this.image,
      this.frame * this.spriteWidth,
      0,
      this.spriteWidth,
      this.spriteHeight,
      this.x,
      this.y,
      this.width,
      this.height
    );
  }
}
let explosions = [];
class Explosions {
  constructor(x, y, size) {
    this.image = new Image();
    this.image.src = "./img/explode_anim.png";
    this.spriteWidth = 32;
    this.spriteHeight = 32;
    this.size = size;
    this.x = x;
    this.y = y;
    this.frame = 0;
    this.timeSinceLastFrame = 0;
    this.frameInterval = 50;
    this.markedForDeletion = false;
  }
  update(deltaTime) {
    this.timeSinceLastFrame += deltaTime;
    if (this.timeSinceLastFrame > this.frameInterval) {
      this.frame++;
      this.timeSinceLastFrame = 0;
      if (this.frame > 6) this.markedForDeletion = true;
    }
  }
  draw() {
    ctx.drawImage(
      this.image,
      this.frame * this.spriteWidth,
      0,
      this.spriteWidth,
      this.spriteHeight,
      this.x,
      this.y - this.size / 4,
      this.size,
      this.size
    );
  }
}

function drawScore() {
  ctx.fillStyle = "black";
  ctx.fillText("Score: " + score, 85, 75);
  ctx.fillStyle = "white";
  ctx.fillText("Score: " + score, 90, 80);
}
function drawGameOver() {
  ctx.textAlign = "center";
  ctx.fillStyle = "white";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
  ctx.fillText("SCORE: " + score, canvas.width / 2, canvas.height / 2 + 50);
}

window.addEventListener("click", function (e) {
  const detectPixelColor = collisionCtx.getImageData(e.x, e.y, 1, 1);
  const pc = detectPixelColor.data;
  hawks.forEach((object) => {
    if (
      object.randomColors[0] === pc[0] &&
      object.randomColors[1] === pc[1] &&
      object.randomColors[2] === pc[2]
    ) {
      object.markedForDeletion = true;
      score++;
      explosions.push(new Explosions(object.x, object.y, object.width));
    }
  });
});

canvas.addEventListener("click", function (e) {
  if (gameOver) {
    gameOver = false;
    hawks = [];
    score = 0;
    animate(0);
  }
});

function animate(timestamp) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  collisionCtx.clearRect(0, 0, canvas.width, canvas.height);
  let deltaTime = timestamp - lastTime;
  lastTime = timestamp;
  timeToNextHawk += deltaTime;
  if (timeToNextHawk > hawkInterval) {
    hawks.push(new Hawk());
    timeToNextHawk = 0;
    hawks.sort(function (a, b) {
      return a.width - b.width;
    });
  }
  drawScore();
  [...hawks, ...explosions].forEach((object) => object.update(deltaTime));
  [...hawks, ...explosions].forEach((object) => object.draw());
  hawks = hawks.filter((object) => !object.markedForDeletion);
  explosions = explosions.filter((object) => !object.markedForDeletion);
  if (!gameOver) requestAnimationFrame(animate);
  else drawGameOver();
}

animate(0);
