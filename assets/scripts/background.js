const canvas = document.getElementById('cosmicCanvas');
const ctx = canvas.getContext('2d');

let w, h;
let particles = [];
const particleCount = 150; // Số lượng hạt ánh sáng

// Bảng màu cho các hạt ánh sáng giống trong hình
const colors = ['#ffffff', '#ffdf80', '#ff80bf', '#80dfff', '#c299ff', '#ffb347'];

// Hàm điều chỉnh kích thước canvas khớp với màn hình
function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Lớp Particle (Hạt ánh sáng)
class Particle {
    constructor() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.size = Math.random() * 3 + 1; // Kích thước từ 1 đến 4
        // Tốc độ trôi ngẫu nhiên (chậm)
        this.speedX = (Math.random() * 0.8) - 0.4;
        this.speedY = (Math.random() * 0.8) - 0.4;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.alpha = Math.random() * 0.6 + 0.4; // Độ trong suốt
        this.glow = this.size * 4; // Bán kính phát sáng
    }

    // Cập nhật vị trí
    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Nếu bay ra khỏi màn hình thì xuất hiện lại ở cạnh đối diện
        if (this.x > w) this.x = 0;
        if (this.x < 0) this.x = w;
        if (this.y > h) this.y = 0;
        if (this.y < 0) this.y = h;
    }

    // Vẽ hạt lên canvas
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.alpha;
        
        // Tạo hiệu ứng phát sáng (Glow)
        ctx.shadowBlur = this.glow;
        ctx.shadowColor = this.color;
        
        ctx.fill();
        
        // Reset để không ảnh hưởng các vật thể khác
        ctx.shadowBlur = 0; 
        ctx.globalAlpha = 1;
    }
}

// Khởi tạo mảng các hạt
function init() {
    particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
}

// Hàm vẽ các đường vân sóng mờ làm nền
function drawWaves() {
    const time = Date.now() * 0.0005;
    ctx.lineWidth = 1;
    for(let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, h/2);
        for(let x = 0; x < w; x++) {
            // Sử dụng hàm sin để tạo sóng
            let y = h/2 + Math.sin(x * 0.005 + time + i) * 150 * ((i+1)*0.2);
            ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(255, 255, 255, 0.0${3})`; // Rất mờ
        ctx.stroke();
    }
}

// Vòng lặp Animation
function animate() {
    ctx.clearRect(0, 0, w, h); // Xóa khung hình cũ
    
    drawWaves(); // Vẽ các đường sóng gợn mờ

    particles.forEach(p => {
        p.update();
        p.draw();
    });
    
    requestAnimationFrame(animate); // Gọi lại hàm animate liên tục
}

init();
animate();