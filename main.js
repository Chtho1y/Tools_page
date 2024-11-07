// Fish Animation
var RENDERER = {
    POINT_INTERVAL: 5,
    FISH_COUNT: 13,
    MAX_INTERVAL_COUNT: 50,
    INIT_HEIGHT_RATE: 0.5,
    THRESHOLD: 50,

    init: function () {
        this.setParameters();
        this.reconstructMethods();
        this.setup();
        this.bindEvent();
        this.render();
    },
    setParameters: function () {
        this.$window = $(window);
        this.$container = $('#flyfish');
        this.$canvas = $('<canvas />');
        this.context = this.$canvas.appendTo(this.$container).get(0).getContext('2d');
        this.points = [];
        this.fishes = [];
        this.watchIds = [];
    },
    createSurfacePoints: function () {
        var count = Math.round(this.width / this.POINT_INTERVAL);
        this.pointInterval = this.width / (count - 1);
        this.points.push(new SURFACE_POINT(this, 0));
        for (var i = 1; i < count; i++) {
            var point = new SURFACE_POINT(this, i * this.pointInterval),
                previous = this.points[i - 1];
            point.setPreviousPoint(previous);
            previous.setNextPoint(point);
            this.points.push(point);
        }
    },
    reconstructMethods: function () {
        this.watchWindowSize = this.watchWindowSize.bind(this);
        this.jdugeToStopResize = this.jdugeToStopResize.bind(this);
        this.startEpicenter = this.startEpicenter.bind(this);
        this.moveEpicenter = this.moveEpicenter.bind(this);
        this.render = this.render.bind(this);
    },
    setup: function () {
        this.points.length = 0;
        this.fishes.length = 0;
        this.watchIds.length = 0;
        this.intervalCount = this.MAX_INTERVAL_COUNT;
        this.width = this.$container.width();
        this.height = this.$container.height();
        this.fishCount = this.FISH_COUNT;
        // * this.width / 500 * this.height / 500
        this.$canvas.attr({ width: this.width, height: this.height });
        this.reverse = false;
        this.fishes.push(new FISH(this));
        this.createSurfacePoints();
    },
    watchWindowSize: function () {
        this.clearTimer();
        this.tmpWidth = this.$window.width();
        this.tmpHeight = this.$window.height();
        this.watchIds.push(setTimeout(this.jdugeToStopResize, this.WATCH_INTERVAL));
    },
    clearTimer: function () {
        while (this.watchIds.length > 0) {
            clearTimeout(this.watchIds.pop());
        }
    },
    jdugeToStopResize: function () {
        var width = this.$window.width(),
            height = this.$window.height(),
            stopped = (width == this.tmpWidth && height == this.tmpHeight);
        this.tmpWidth = width;
        this.tmpHeight = height;
        if (stopped) {
            this.setup();
        }
    },
    bindEvent: function () {
        this.$window.on('resize', this.watchWindowSize);
        this.$container.on('mouseenter', this.startEpicenter);
        this.$container.on('mousemove', this.moveEpicenter);
    },
    getAxis: function (event) {
        var offset = this.$container.offset();
        return {
            x: event.clientX - offset.left + this.$window.scrollLeft(),
            y: event.clientY - offset.top + this.$window.scrollTop()
        };
    },
    startEpicenter: function (event) {
        this.axis = this.getAxis(event);
    },
    moveEpicenter: function (event) {
        var axis = this.getAxis(event);
        if (!this.axis) {
            this.axis = axis;
        }
        this.generateEpicenter(axis.x, axis.y, axis.y - this.axis.y);
        this.axis = axis;
    },
    generateEpicenter: function (x, y, velocity) {
        if (y < this.height / 2 - this.THRESHOLD || y > this.height / 2 + this.THRESHOLD) {
            return;
        }
        var index = Math.round(x / this.pointInterval);
        if (index < 0 || index >= this.points.length) {
            return;
        }
        this.points[index].interfere(y, velocity);
    },
    controlStatus: function () {
        for (var i = 0, count = this.points.length; i < count; i++) {
            this.points[i].updateSelf();
        }
        for (var i = 0, count = this.points.length; i < count; i++) {
            this.points[i].updateNeighbors();
        }
        if (this.fishes.length < this.fishCount) {
            if (--this.intervalCount == 0) {
                this.intervalCount = this.MAX_INTERVAL_COUNT;
                this.fishes.push(new FISH(this));
            }
        }
    },
    render: function () {
        requestAnimationFrame(this.render);
        this.controlStatus();
        this.context.clearRect(0, 0, this.width, this.height);
        this.context.fillStyle = 'hsl(0, 0%, 92%)';

        for (var i = 0, count = this.fishes.length; i < count; i++) {
            this.fishes[i].render(this.context);
        }
        this.context.save();
        this.context.globalCompositeOperation = 'xor';
        this.context.beginPath();
        this.context.moveTo(0, this.reverse ? 0 : this.height);

        for (var i = 0, count = this.points.length; i < count; i++) {
            this.points[i].render(this.context);
        }
        this.context.lineTo(this.width, this.reverse ? 0 : this.height);
        this.context.closePath();
        this.context.fill();
        this.context.restore();
    }
};

var SURFACE_POINT = function (renderer, x) {
    this.renderer = renderer;
    this.x = x;
    this.init();
};

SURFACE_POINT.prototype = {
    SPRING_CONSTANT: 0.015,
    SPRING_FRICTION: 0.95,
    WAVE_SPREAD: 0.25,
    ACCELARATION_RATE: 0.002,

    init: function () {
        this.initHeight = this.renderer.height * this.renderer.INIT_HEIGHT_RATE;
        this.height = this.initHeight;
        this.fy = 0;
        this.force = { previous: 0, next: 0 };
    },
    setPreviousPoint: function (previous) {
        this.previous = previous;
    },
    setNextPoint: function (next) {
        this.next = next;
    },
    interfere: function (y, velocity) {
        this.fy = this.renderer.height * this.ACCELARATION_RATE * ((this.renderer.height - this.height - y) >= 0 ? -1 : 1) * Math.abs(velocity);
    },
    updateSelf: function () {
        this.fy += this.SPRING_CONSTANT * (this.initHeight - this.height);
        this.fy *= this.SPRING_FRICTION;
        this.height += this.fy;
    },
    updateNeighbors: function () {
        if (this.previous) {
            this.force.previous = this.WAVE_SPREAD * (this.height - this.previous.height);
        }
        if (this.next) {
            this.force.next = this.WAVE_SPREAD * (this.height - this.next.height);
        }
    },
    render: function (context) {
        if (this.previous) {
            this.previous.height += this.force.previous;
            this.previous.fy += this.force.previous;
        }
        if (this.next) {
            this.next.height += this.force.next;
            this.next.fy += this.force.next;
        }
        context.lineTo(this.x, this.renderer.height - this.height);
    }
};

var FISH = function (renderer) {
    this.renderer = renderer;
    this.init();
};

FISH.prototype = {
    GRAVITY: 0.3,

    init: function () {
        this.direction = Math.random() < 0.5;
        this.x = this.direction ? (this.renderer.width + this.renderer.THRESHOLD) : -this.renderer.THRESHOLD;
        this.previousY = this.y;
        this.vx = this.getRandomValue(2, 8) * (this.direction ? -1 : 1);

        if (this.renderer.reverse) {
            this.y = this.getRandomValue(this.renderer.height * 1 / 10, this.renderer.height * 4 / 10);
            this.vy = this.getRandomValue(1, 4);
            this.ay = this.getRandomValue(0.03, 0.15);
        } else {
            this.y = this.getRandomValue(this.renderer.height * 6 / 10, this.renderer.height * 9 / 10);
            this.vy = this.getRandomValue(-4, -1);
            this.ay = this.getRandomValue(-0.15, -0.03);
        }
        this.isOut = false;
        this.theta = 0;
        this.phi = 0;
    },
    getRandomValue: function (min, max) {
        return min + (max - min) * Math.random();
    },
    controlStatus: function (context) {
        this.previousY = this.y;
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.ay;

        if (this.renderer.reverse) {
            if (this.y > this.renderer.height * this.renderer.INIT_HEIGHT_RATE) {
                this.vy -= this.GRAVITY;
                this.isOut = true;
            } else {
                if (this.isOut) {
                    this.ay = this.getRandomValue(0.03, 0.15);
                }
                this.isOut = false;
            }
        } else {
            if (this.y < this.renderer.height * this.renderer.INIT_HEIGHT_RATE) {
                this.vy += this.GRAVITY;
                this.isOut = true;
            } else {
                if (this.isOut) {
                    this.ay = this.getRandomValue(-0.15, -0.03);
                }
                this.isOut = false;
            }
        }
        if (!this.isOut) {
            this.theta += Math.PI / 40;
            this.theta %= Math.PI * 2;
            this.phi += Math.PI / 50;
            this.phi %= Math.PI * 2;
        }
        this.renderer.generateEpicenter(this.x + (this.direction ? -1 : 1) * this.renderer.THRESHOLD, this.y, this.y - this.previousY);
        if (this.vx > 0 && this.x > this.renderer.width + this.renderer.THRESHOLD || this.vx < 0 && this.x < -this.renderer.THRESHOLD) {
            this.init();
        }
    },
    render: function (context) {
        context.save();
        context.translate(this.x, this.y);
        context.rotate(Math.PI + Math.atan2(this.vy, this.vx));
        context.scale(1, this.direction ? 1 : -1);
        context.beginPath();
        context.moveTo(-30, 0);
        context.bezierCurveTo(-20, 15, 15, 10, 40, 0);
        context.bezierCurveTo(15, -10, -20, -15, -30, 0);
        context.fill();

        context.save();
        context.translate(40, 0);
        context.scale(0.9 + 0.2 * Math.sin(this.theta), 1);
        context.beginPath();
        context.moveTo(0, 0);
        context.quadraticCurveTo(5, 10, 20, 8);
        context.quadraticCurveTo(12, 5, 10, 0);
        context.quadraticCurveTo(12, -5, 20, -8);
        context.quadraticCurveTo(5, -10, 0, 0);
        context.fill();
        context.restore();

        context.save();
        context.translate(-3, 0);
        context.rotate((Math.PI / 3 + Math.PI / 10 * Math.sin(this.phi)) * (this.renderer.reverse ? -1 : 1));
        context.beginPath();

        if (this.renderer.reverse) {
            context.moveTo(5, 0);
            context.bezierCurveTo(10, 10, 10, 30, 0, 40);
            context.bezierCurveTo(-12, 25, -8, 10, 0, 0);
        } else {
            context.moveTo(-5, 0);
            context.bezierCurveTo(-10, -10, -10, -30, 0, -40);
            context.bezierCurveTo(12, -25, 8, -10, 0, 0);
        }
        context.closePath();
        context.fill();
        context.restore();
        context.restore();
        this.controlStatus(context);
    }
};

// Tool Filtering System
document.addEventListener('DOMContentLoaded', function () {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const toolCards = document.querySelectorAll('.tool-card');

    // Smooth scroll for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Tool filtering
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');

            const filter = button.getAttribute('data-filter');

            toolCards.forEach(card => {
                if (filter === 'all' || card.getAttribute('data-category') === filter) {
                    card.style.display = 'block';
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }, 10);
                } else {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        card.style.display = 'none';
                    }, 300);
                }
            });
        });
    });

    // Comments System
    const API_URL = 'http://47.236.62.225:7805/comments';
    const commentsGrid = document.getElementById('commentsGrid');
    const commentTextarea = document.querySelector('.comment-form textarea');
    const submitButton = document.querySelector('.submit-comment');
    const imageInput = document.getElementById('imageInput');
    const imagePreview = document.getElementById('imagePreview');

    // 从后端获取评论
    async function loadComments() {
        try {
            const response = await fetch(API_URL);
            const comments = await response.json();
            commentsGrid.innerHTML = ''; // 清空之前的内容
            comments.forEach(comment => {
                const commentElement = createCommentElement(comment.text, comment.image, comment.author, comment.date);
                commentsGrid.appendChild(commentElement);
            });
        } catch (error) {
            console.error('Error fetching comments:', error);
        }
    }

    // 提交评论到后端
    async function postComment(commentData) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(commentData)
            });
            return response.json();
        } catch (error) {
            console.error('Error posting comment:', error);
        }
    }

    submitButton.addEventListener('click', async function () {
        const commentText = commentTextarea.value.trim();
        const imageSrc = imagePreview.src || '';

        if (!commentText && !imageSrc) return; // 如果没有文本或图片则不提交

        const newComment = {
            text: commentText,
            image: imageSrc,
            author: 'Anonymous User'
        };

        const savedComment = await postComment(newComment);
        const commentElement = createCommentElement(
            savedComment.text,
            savedComment.image,
            savedComment.author,
            savedComment.date
        );
        commentsGrid.insertBefore(commentElement, commentsGrid.firstChild);

        // 重置表单
        commentTextarea.value = '';
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        imageInput.value = '';
    });

    imageInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    function createCommentElement(text, imageSrc, author = 'Anonymous User', dateStr = new Date().toISOString()) {
        const comment = document.createElement('div');
        comment.className = 'comment-card';

        const header = document.createElement('div');
        header.className = 'comment-header';

        const avatar = document.createElement('div');
        avatar.className = 'comment-avatar';
        avatar.innerHTML = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${dateStr}" alt="Avatar">`;

        const meta = document.createElement('div');
        meta.className = 'comment-meta';

        const authorElem = document.createElement('p');
        authorElem.className = 'comment-author';
        authorElem.textContent = author;

        const date = document.createElement('span');
        date.className = 'comment-date';
        date.textContent = new Date(dateStr).toLocaleDateString();

        meta.appendChild(authorElem);
        meta.appendChild(date);
        header.appendChild(avatar);
        header.appendChild(meta);
        comment.appendChild(header);

        if (text) {
            const content = document.createElement('div');
            content.className = 'comment-content';
            content.textContent = text;
            comment.appendChild(content);
        }

        if (imageSrc && imageSrc !== '') {
            const image = document.createElement('img');
            image.className = 'comment-image';
            image.src = imageSrc;
            image.alt = 'Comment image';
            comment.appendChild(image);
        }

        return comment;
    }

    // Initialize comments
    loadComments();
});

$(function () {
    RENDERER.init();
});
