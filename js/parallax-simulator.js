// 연주시차 시뮬레이터 JavaScript

class ParallaxSimulator {
    constructor() {
        // 조감도 캔버스
        this.canvas = document.getElementById('parallaxCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 천구 캔버스
        this.celestialCanvas = document.getElementById('celestialCanvas');
        this.celestialCtx = this.celestialCanvas.getContext('2d');
        
        // 캔버스 크기 설정
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // 시뮬레이션 상태
        this.isPlaying = false;
        this.animationSpeed = 1.0;
        this.time = 0;
        this.earthOrbitRadius = 100;
        
        // A/B점 도달 감지 및 강조 효과
        this.highlightEffect = {
            isActive: false,
            intensity: 0,
            targetStar: null
        };
        
        // 천구 시뮬레이터 데이터
        this.celestialData = {
            // 천구상 별 위치 (각도 단위)
            starX: { angle: 0, baseAngle: 0 },
            starY: { angle: 0, baseAngle: 0 },
            // 배경별들의 기준 위치
            backgroundStarPositions: []
        };
        
        this.initializeCelestialSphere();
        
        // 별 데이터 (태양-별X-별Y 완전 일직선 배치)
        // 별들은 위쪽에 배치 (원래대로)
        this.stars = {
            X: {
                distance: 2.0, // parsecs
                x: 0,    // 태양과 같은 x좌표 (일직선)
                y: -200, // 태양에서 위쪽으로 (가까운 별)
                parallax: 0,
                color: '#ffeb3b', // 밝은 노란색
                baseAngle: 0
            },
            Y: {
                distance: 20.0, // parsecs  
                x: 0,    // 태양과 같은 x좌표 (일직선)
                y: -350, // 별X보다 더 멀리 (태양-별X-별Y 일직선)
                parallax: 0,
                color: '#ff9800', // 주황색
                baseAngle: 0
            }
        };
        
        // 전체 천체 시스템을 아래로 이동시키기 위한 오프셋
        this.systemOffset = {
            x: 0,
            y: 80  // 전체를 80px 아래로 이동
        };
        
        // 배경별들
        this.backgroundStars = [];
        this.generateBackgroundStars();
        
        // 지구 위치 (조감도 시점)
        this.earthPos = { x: 0, y: 0 };
        this.earthPhase = 0; // A점(0도)에서 시작, 반시계방향 공전
        
        // 조감도 시점 (위에서 내려다보는 시각)
        this.viewMode = 'topDown'; // 'topDown' 모드
        
        // 시선 방향과 시차각 표시용
        this.sightLines = {
            X: { fromA: {angle: 0}, fromB: {angle: 0}, parallaxAngle: 0 },
            Y: { fromA: {angle: 0}, fromB: {angle: 0}, parallaxAngle: 0 }
        };
        
        this.initializeControls();
        this.animate();
    }
    
    initializeCelestialSphere() {
        // 배경별들의 천구상 위치 초기화 (고정 위치)
        this.celestialData.backgroundStarPositions = [];
        for (let i = 0; i < 20; i++) {
            this.celestialData.backgroundStarPositions.push({
                angle: (i * 18) + Math.random() * 10 - 5, // 18도 간격으로 배치, ±5도 랜덤
                brightness: Math.random() * 0.8 + 0.3,
                size: Math.random() * 2 + 1
            });
        }
        
        // 별 X, Y의 기준 각도 설정 (중앙 부근)
        this.celestialData.starX.baseAngle = 180; // 중앙
        this.celestialData.starY.baseAngle = 180; // 중앙 (같은 일직선상)
    }
    
    resizeCanvas() {
        // 조감도 캔버스 크기 설정
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        this.centerX = rect.width / 2;
        this.centerY = rect.height / 2;
        
        // 천구 캔버스 크기 설정
        const celestialRect = this.celestialCanvas.getBoundingClientRect();
        this.celestialCanvas.width = celestialRect.width * window.devicePixelRatio;
        this.celestialCanvas.height = celestialRect.height * window.devicePixelRatio;
        this.celestialCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        this.celestialCenterX = celestialRect.width / 2;
        this.celestialCenterY = celestialRect.height / 2;
    }
    
    generateBackgroundStars() {
        this.backgroundStars = [];
        // 조감도 시점용 배경별 생성 (더 멀리 배치)
        for (let i = 0; i < 150; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 400 + 300; // 더 멀리 배치
            this.backgroundStars.push({
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                brightness: Math.random() * 0.6 + 0.3,
                size: Math.random() * 1.5 + 0.5
            });
        }
    }
    
    initializeControls() {
        // 재생/일시정지 버튼
        const playPauseBtn = document.getElementById('playPauseBtn');
        playPauseBtn.addEventListener('click', () => {
            this.isPlaying = !this.isPlaying;
            const icon = playPauseBtn.querySelector('i');
            if (this.isPlaying) {
                icon.className = 'fas fa-pause';
                playPauseBtn.classList.add('playing');
            } else {
                icon.className = 'fas fa-play';
                playPauseBtn.classList.remove('playing');
            }
        });
        
        // 리셋 버튼
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.time = 0;
            this.earthPhase = 0;
            this.updateEarthPosition();
            this.updateStarPositions();
            this.updateUI();
        });
        
        // 속도 슬라이더
        const speedSlider = document.getElementById('speedSlider');
        speedSlider.addEventListener('input', () => {
            this.animationSpeed = parseFloat(speedSlider.value);
            document.getElementById('speedValue').textContent = `${this.animationSpeed.toFixed(1)}x`;
        });
        
        // 별 거리 슬라이더
        const starXSlider = document.getElementById('starXDistanceSlider');
        starXSlider.addEventListener('input', () => {
            this.stars.X.distance = parseFloat(starXSlider.value);
            document.getElementById('starXDistanceValue').textContent = this.stars.X.distance.toFixed(1);
            this.updateStarPositions();
            this.updateUI();
        });
        
        const starYSlider = document.getElementById('starYDistanceSlider');
        starYSlider.addEventListener('input', () => {
            this.stars.Y.distance = parseFloat(starYSlider.value);
            document.getElementById('starYDistanceValue').textContent = this.stars.Y.distance.toFixed(1);
            this.updateStarPositions();
            this.updateUI();
        });
        
        // 초기 UI 업데이트
        this.updateUI();
    }
    
    updateEarthPosition() {
        // 반시계방향 공전: A점(0도) -> B점(180도) -> A점
        if (this.isPlaying) {
            this.earthPhase += 0.02 * this.animationSpeed; // 연속적인 공전
            if (this.earthPhase >= 2 * Math.PI) {
                this.earthPhase = 0; // 한 바퀴 완성 후 리셋
            }
        }
        
        // 반시계방향 공전 (y축 반전으로 시각적 반시계방향 구현)
        // A점: 오른쪽(0도), B점: 왼쪽(180도)
        this.earthPos.x = this.earthOrbitRadius * Math.cos(this.earthPhase);
        this.earthPos.y = -this.earthOrbitRadius * Math.sin(this.earthPhase); // y축 반전으로 반시계방향
    }
    
    updateStarPositions() {
        // 연주시차 계산 (거리와 반비례)
        // 연주시차 (초각) = 1 / 거리 (파섹)
        this.stars.X.parallax = 1 / this.stars.X.distance;
        this.stars.Y.parallax = 1 / this.stars.Y.distance;
        
        // A점과 B점 도달 감지 및 강조 효과
        const tolerance = 0.1; // 도달 감지 허용 오차
        
        // A점 도달 감지 (0도 근처)
        if (Math.abs(this.earthPhase) < tolerance || Math.abs(this.earthPhase - 2*Math.PI) < tolerance) {
            this.highlightEffect.isActive = true;
            this.highlightEffect.intensity = 1.0;
            this.highlightEffect.targetStar = 'both';
        }
        // B점 도달 감지 (π 근처)
        else if (Math.abs(this.earthPhase - Math.PI) < tolerance) {
            this.highlightEffect.isActive = true;
            this.highlightEffect.intensity = 1.0;
            this.highlightEffect.targetStar = 'both';
        }
        // 강조 효과 서서히 감소
        else if (this.highlightEffect.isActive) {
            this.highlightEffect.intensity -= 0.05;
            if (this.highlightEffect.intensity <= 0) {
                this.highlightEffect.isActive = false;
            }
        }
        
        // A점과 B점에서의 시선 방향 계산
        const earthPosA = { x: this.earthOrbitRadius, y: 0 }; // A점
        const earthPosB = { x: -this.earthOrbitRadius, y: 0 }; // B점 (반시계방향)
        
        // 별 X에 대한 시선 각도
        this.sightLines.X.fromA.angle = Math.atan2(this.stars.X.y - earthPosA.y, this.stars.X.x - earthPosA.x);
        this.sightLines.X.fromB.angle = Math.atan2(this.stars.X.y - earthPosB.y, this.stars.X.x - earthPosB.x);
        this.sightLines.X.parallaxAngle = Math.abs(this.sightLines.X.fromA.angle - this.sightLines.X.fromB.angle);
        
        // 별 Y에 대한 시선 각도
        this.sightLines.Y.fromA.angle = Math.atan2(this.stars.Y.y - earthPosA.y, this.stars.Y.x - earthPosA.x);
        this.sightLines.Y.fromB.angle = Math.atan2(this.stars.Y.y - earthPosB.y, this.stars.Y.x - earthPosB.x);
        this.sightLines.Y.parallaxAngle = Math.abs(this.sightLines.Y.fromA.angle - this.sightLines.Y.fromB.angle);
    }
    
    project2D(x, y) {
        // 조감도 시점: 2D 좌표를 캔버스 좌표로 변환 (전체 시스템 오프셋 적용)
        return {
            x: this.centerX + x + this.systemOffset.x,
            y: this.centerY + y + this.systemOffset.y
        };
    }
    
    drawSun() {
        const sunPos = this.project2D(0, 0);
        
        // 태양 그리기 (조감도 시점)
        this.ctx.fillStyle = '#ffd700';
        this.ctx.shadowColor = '#ffd700';
        this.ctx.shadowBlur = 25;
        this.ctx.beginPath();
        this.ctx.arc(sunPos.x, sunPos.y, 15, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        
        // 태양 라벨
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 14px Noto Sans KR';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('태양', sunPos.x, sunPos.y - 25);
    }
    
    drawEarth() {
        const earthPos = this.project2D(this.earthPos.x, this.earthPos.y);
        
        // 지구 궤도 그리기 (먼저 그려서 뒤에 위치)
        const sunPos = this.project2D(0, 0);
        this.ctx.strokeStyle = 'rgba(79, 195, 247, 0.4)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([8, 4]);
        this.ctx.beginPath();
        this.ctx.arc(sunPos.x, sunPos.y, this.earthOrbitRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // A점과 B점 표시 (이등변삼각형 구조)
        const pointA = this.project2D(this.earthOrbitRadius, 0);  // 오른쪽 (0도)
        const pointB = this.project2D(-this.earthOrbitRadius, 0); // 왼쪽 (180도)
        
        // A점 표시
        this.ctx.fillStyle = 'rgba(79, 195, 247, 0.8)';
        this.ctx.beginPath();
        this.ctx.arc(pointA.x, pointA.y, 5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 13px Noto Sans KR';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('A점', pointA.x + 12, pointA.y + 5);
        
        // B점 표시
        this.ctx.fillStyle = 'rgba(79, 195, 247, 0.8)';
        this.ctx.beginPath();
        this.ctx.arc(pointB.x, pointB.y, 5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'right';
        this.ctx.fillText('B점', pointB.x - 12, pointB.y + 5);
        
        // 이등변삼각형 표시를 위한 보조선 (희미하게)
        const starXPos = this.project2D(this.stars.X.x, this.stars.X.y);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([3, 3]);
        
        // A점-별X, B점-별X 연결선 (이등변삼각형)
        this.ctx.beginPath();
        this.ctx.moveTo(pointA.x, pointA.y);
        this.ctx.lineTo(starXPos.x, starXPos.y);
        this.ctx.moveTo(pointB.x, pointB.y);
        this.ctx.lineTo(starXPos.x, starXPos.y);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
        
        // 지구 그리기
        this.ctx.fillStyle = '#4fc3f7';
        this.ctx.shadowColor = '#4fc3f7';
        this.ctx.shadowBlur = 15;
        this.ctx.beginPath();
        this.ctx.arc(earthPos.x, earthPos.y, 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        
        // 지구 현재 위치 라벨 (공전 각도 기반)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 12px Noto Sans KR';
        this.ctx.textAlign = 'center';
        
        // 현재 각도에 따른 위치 표시
        let positionLabel = '지구';
        if (this.earthPhase < Math.PI / 4 || this.earthPhase > 7 * Math.PI / 4) {
            positionLabel = '지구 (A점 근처)';
        } else if (this.earthPhase > 3 * Math.PI / 4 && this.earthPhase < 5 * Math.PI / 4) {
            positionLabel = '지구 (B점 근처)';
        } else {
            positionLabel = '지구 (공전 중)';
        }
        
        this.ctx.fillText(positionLabel, earthPos.x, earthPos.y - 18);
    }
    
    drawStars() {
        // 별 X 그리기 (가까운 별)
        const starXPos = this.project2D(this.stars.X.x, this.stars.X.y);
        
        this.ctx.fillStyle = this.stars.X.color;
        this.ctx.shadowColor = this.stars.X.color;
        this.ctx.shadowBlur = 20;
        this.ctx.beginPath();
        this.ctx.arc(starXPos.x, starXPos.y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 별 X 내부 밝은 점
        this.ctx.fillStyle = '#ffffff';
        this.ctx.shadowBlur = 0;
        this.ctx.beginPath();
        this.ctx.arc(starXPos.x, starXPos.y, 3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 별 X 라벨
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 13px Noto Sans KR';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`별 X (${this.stars.X.distance}pc)`, starXPos.x, starXPos.y - 20);
        
        // 별 Y 그리기 (먼 별)
        const starYPos = this.project2D(this.stars.Y.x, this.stars.Y.y);
        
        this.ctx.fillStyle = this.stars.Y.color;
        this.ctx.shadowColor = this.stars.Y.color;
        this.ctx.shadowBlur = 15;
        this.ctx.beginPath();
        this.ctx.arc(starYPos.x, starYPos.y, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 별 Y 내부 밝은 점
        this.ctx.fillStyle = '#ffffff';
        this.ctx.shadowBlur = 0;
        this.ctx.beginPath();
        this.ctx.arc(starYPos.x, starYPos.y, 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 별 Y 라벨
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 13px Noto Sans KR';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`별 Y (${this.stars.Y.distance}pc)`, starYPos.x, starYPos.y - 18);
    }
    
    drawBackgroundStars() {
        this.backgroundStars.forEach(star => {
            const pos = this.project2D(star.x, star.y);
            this.ctx.globalAlpha = star.brightness * 0.7;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        this.ctx.globalAlpha = 1;
    }
    
    drawSightLines() {
        // 현재 지구에서 별들로의 시선 라인
        const earthPos = this.project2D(this.earthPos.x, this.earthPos.y);
        const starXPos = this.project2D(this.stars.X.x, this.stars.X.y);
        const starYPos = this.project2D(this.stars.Y.x, this.stars.Y.y);
        
        // 현재 지구 위치에서 별들로의 시선 (강조 효과 적용)
        let lineOpacity = 0.8;
        let lineWidth = 2;
        
        if (this.highlightEffect.isActive) {
            lineOpacity = 0.8 + this.highlightEffect.intensity * 0.2;
            lineWidth = 2 + this.highlightEffect.intensity * 3;
        }
        
        this.ctx.strokeStyle = `rgba(79, 195, 247, ${lineOpacity})`;
        this.ctx.lineWidth = lineWidth;
        this.ctx.setLineDash([6, 3]);
        
        // 강조 효과가 있을 때 그림자 추가
        if (this.highlightEffect.isActive) {
            this.ctx.shadowColor = '#4fc3f7';
            this.ctx.shadowBlur = 10 * this.highlightEffect.intensity;
        }
        
        // 지구에서 별 X로
        this.ctx.beginPath();
        this.ctx.moveTo(earthPos.x, earthPos.y);
        this.ctx.lineTo(starXPos.x, starXPos.y);
        this.ctx.stroke();
        
        // 지구에서 별 Y로
        this.ctx.beginPath();
        this.ctx.moveTo(earthPos.x, earthPos.y);
        this.ctx.lineTo(starYPos.x, starYPos.y);
        this.ctx.stroke();
        
        // 그림자 효과 리셋
        this.ctx.shadowBlur = 0;
        
        this.ctx.setLineDash([]);
        
        // 화살표 그리기
        this.drawArrow(earthPos, starXPos, '#ffeb3b');
        this.drawArrow(earthPos, starYPos, '#ff9800');
    }
    
    drawArrow(from, to, color) {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const length = 20;
        const arrowSize = 8;
        
        // 화살표 위치 (시선의 중간 지점)
        const midX = from.x + (to.x - from.x) * 0.3;
        const midY = from.y + (to.y - from.y) * 0.3;
        
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        
        // 화살촉
        this.ctx.beginPath();
        this.ctx.moveTo(midX, midY);
        this.ctx.lineTo(midX - arrowSize * Math.cos(angle - Math.PI/6), midY - arrowSize * Math.sin(angle - Math.PI/6));
        this.ctx.lineTo(midX - arrowSize * Math.cos(angle + Math.PI/6), midY - arrowSize * Math.sin(angle + Math.PI/6));
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    drawParallaxVisualization() {
        // A점과 B점에서의 관측 방향 차이 시각화 (일직선 배치용)
        const pointA = this.project2D(this.earthOrbitRadius, 0);
        const pointB = this.project2D(-this.earthOrbitRadius, 0);
        const starXPos = this.project2D(this.stars.X.x, this.stars.X.y);
        const starYPos = this.project2D(this.stars.Y.x, this.stars.Y.y);
        const sunPos = this.project2D(0, 0);
        
        // 태양-별X-별Y 일직선 강조
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(sunPos.x, sunPos.y);
        this.ctx.lineTo(starXPos.x, starXPos.y);
        this.ctx.lineTo(starYPos.x, starYPos.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // 별 X에 대한 연주시차 호 그리기 (태양 중심)
        this.drawParallaxArcCorrect(pointA, pointB, starXPos, '#ffeb3b', 'X');
        
        // 별 Y에 대한 연주시차 호 그리기 (태양 중심)
        this.drawParallaxArcCorrect(pointA, pointB, starYPos, '#ff9800', 'Y');
        
        // A점과 B점에서의 시선 방향 (희미하게)
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([3, 3]);
        
        // A점에서 별들로
        this.ctx.beginPath();
        this.ctx.moveTo(pointA.x, pointA.y);
        this.ctx.lineTo(starXPos.x, starXPos.y);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(pointA.x, pointA.y);
        this.ctx.lineTo(starYPos.x, starYPos.y);
        this.ctx.stroke();
        
        // B점에서 별들로
        this.ctx.beginPath();
        this.ctx.moveTo(pointB.x, pointB.y);
        this.ctx.lineTo(starXPos.x, starXPos.y);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(pointB.x, pointB.y);
        this.ctx.lineTo(starYPos.x, starYPos.y);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
    }
    
    drawParallaxArcCorrect(pointA, pointB, star, color, starName) {
        // 정확한 연주시차: 태양-별-지구(A점)이 이루는 각도 (별을 꼭짓점으로)
        const sunPos = this.project2D(0, 0);
        
        // 별에서 태양으로의 방향
        const starToSunAngle = Math.atan2(sunPos.y - star.y, sunPos.x - star.x);
        
        // 별에서 A점으로의 방향
        const starToEarthAAngle = Math.atan2(pointA.y - star.y, pointA.x - star.x);
        
        // 연주시차 각도 (별을 꼭짓점으로 하는 각도)
        let parallaxAngle = Math.abs(starToSunAngle - starToEarthAAngle);
        if (parallaxAngle > Math.PI) {
            parallaxAngle = 2 * Math.PI - parallaxAngle;
        }
        
        // 호의 반지름 (별에서 태양까지 거리의 1/3 정도)
        const distanceToSun = Math.sqrt((sunPos.x - star.x)**2 + (sunPos.y - star.y)**2);
        const radius = Math.min(distanceToSun / 3, 60);
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 4;
        this.ctx.globalAlpha = 0.8;
        
        // 연주시차 호 그리기 (별을 중심으로)
        this.ctx.beginPath();
        const startAngle = Math.min(starToSunAngle, starToEarthAAngle);
        const endAngle = Math.max(starToSunAngle, starToEarthAAngle);
        
        if (Math.abs(endAngle - startAngle) > Math.PI) {
            this.ctx.arc(star.x, star.y, radius, endAngle, startAngle + 2*Math.PI);
        } else {
            this.ctx.arc(star.x, star.y, radius, startAngle, endAngle);
        }
        this.ctx.stroke();
        
        this.ctx.globalAlpha = 1;
        
        // 연주시차 라벨 (별 근처에 표시)
        const midAngle = (starToSunAngle + starToEarthAAngle) / 2;
        const labelX = star.x + (radius + 25) * Math.cos(midAngle);
        const labelY = star.y + (radius + 25) * Math.sin(midAngle);
        
        this.ctx.fillStyle = color;
        this.ctx.font = 'bold 12px Noto Sans KR';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`연주시차 ${starName}`, labelX, labelY);
        
        // 연주시차 = 1/거리 (초각 단위)
        const parallaxArcsec = 1 / (starName === 'X' ? this.stars.X.distance : this.stars.Y.distance);
        this.ctx.font = 'bold 11px Courier New';
        this.ctx.fillText(`${parallaxArcsec.toFixed(3)}"`, labelX, labelY + 14);
    }
    
    updateUI() {
        // 지구 위치 표시 (반시계 공전 기준)
        let earthPosition = '';
        if (this.earthPhase < Math.PI / 4 || this.earthPhase > 7 * Math.PI / 4) {
            earthPosition = 'A점 근처';
        } else if (this.earthPhase > 3 * Math.PI / 4 && this.earthPhase < 5 * Math.PI / 4) {
            earthPosition = 'B점 근처';
        } else {
            earthPosition = '공전 중';
        }
        document.getElementById('earthPosition').textContent = earthPosition;
        
        // 시차각 표시
        document.getElementById('starXParallax').textContent = `${this.stars.X.parallax.toFixed(3)}"`;
        document.getElementById('starYParallax').textContent = `${this.stars.Y.parallax.toFixed(3)}"`;
        
        // 거리 표시
        document.getElementById('starXDistance').textContent = `${this.stars.X.distance.toFixed(1)} pc`;
        document.getElementById('starYDistance').textContent = `${this.stars.Y.distance.toFixed(1)} pc`;
    }
    
    animate() {
        // 캔버스 클리어 (조감도 시점용 배경)
        this.ctx.fillStyle = 'rgba(0, 4, 40, 0.2)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.isPlaying) {
            this.time += 0.02 * this.animationSpeed;
            // 연속적인 반시계방향 공전
            // updateEarthPosition에서 처리되므로 여기서는 삭제
        }
        
        // 위치 업데이트
        this.updateEarthPosition();
        this.updateStarPositions();
        
        // 그리기 (조감도 시점)
        this.drawBackgroundStars();
        this.drawParallaxVisualization();
        this.drawSun();
        this.drawEarth();
        this.drawStars();
        this.drawSightLines();
        
        // UI 업데이트
        this.updateUI();
        
        // 천구 시뮬레이터 그리기
        this.drawCelestialSphere();
        
        requestAnimationFrame(() => this.animate());
    }
    
    calculateCelestialPositions() {
        // 지구 위치에 따른 천구상 별 위치 계산
        // 연주시차 효과: 지구가 A점일 때와 B점일 때의 각도 차이
        
        // 화면 폭의 10% 정도를 최대 시차 범위로 설정 (화면 이탈 방지)
        const screenWidth = this.celestialCanvas.width / window.devicePixelRatio;
        const maxOffset = screenWidth * 0.08; // 8% 범위로 제한
        
        // 별 X의 천구상 위치 (연주시차 효과 적용, 범위 제한)
        const parallaxFactorX = this.stars.X.parallax * 50; // 시각적 효과를 위한 배율
        const rawOffsetX = parallaxFactorX * Math.cos(this.earthPhase);
        const constrainedOffsetX = Math.max(-maxOffset, Math.min(maxOffset, rawOffsetX));
        
        // 각도를 픽셀로 변환하여 계산
        const baseXPixel = (this.celestialData.starX.baseAngle / 360) * screenWidth;
        const finalXPixel = baseXPixel + constrainedOffsetX;
        this.celestialData.starX.angle = (finalXPixel / screenWidth) * 360;
        
        // 별 Y의 천구상 위치 (더 작은 연주시차 효과)
        const parallaxFactorY = this.stars.Y.parallax * 50;
        const rawOffsetY = parallaxFactorY * Math.cos(this.earthPhase);
        const constrainedOffsetY = Math.max(-maxOffset/4, Math.min(maxOffset/4, rawOffsetY)); // 더 작은 범위
        
        const baseYPixel = (this.celestialData.starY.baseAngle / 360) * screenWidth;
        const finalYPixel = baseYPixel + constrainedOffsetY;
        this.celestialData.starY.angle = (finalYPixel / screenWidth) * 360;
    }
    
    drawCelestialSphere() {
        // 천구 캔버스 클리어
        this.celestialCtx.fillStyle = 'rgba(0, 4, 40, 0.9)';
        this.celestialCtx.fillRect(0, 0, this.celestialCanvas.width, this.celestialCanvas.height);
        
        // 천구상 별 위치 계산
        this.calculateCelestialPositions();
        
        // 천구의 띠 (배경별 기준선) 그리기
        this.drawCelestialBelt();
        
        // 배경별들 그리기
        this.drawCelestialBackgroundStars();
        
        // 관측 대상 별들 그리기
        this.drawCelestialTargetStars();
        
        // 천구 정보 업데이트
        this.updateCelestialUI();
    }
    
    drawCelestialBelt() {
        // 천구의 수평 띠 그리기 (배경별들의 기준선)
        const canvasWidth = this.celestialCanvas.width / window.devicePixelRatio;
        const canvasHeight = this.celestialCanvas.height / window.devicePixelRatio;
        const beltY = this.celestialCenterY;
        const beltHeight = canvasHeight * 0.8; // 캔버스 높이의 80%
        
        // 띠 배경
        this.celestialCtx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        this.celestialCtx.fillRect(0, beltY - beltHeight/2, canvasWidth, beltHeight);
        
        // 띠 경계선
        this.celestialCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.celestialCtx.lineWidth = 1;
        this.celestialCtx.setLineDash([3, 3]);
        this.celestialCtx.beginPath();
        this.celestialCtx.moveTo(0, beltY - beltHeight/2);
        this.celestialCtx.lineTo(canvasWidth, beltY - beltHeight/2);
        this.celestialCtx.moveTo(0, beltY + beltHeight/2);
        this.celestialCtx.lineTo(canvasWidth, beltY + beltHeight/2);
        this.celestialCtx.stroke();
        this.celestialCtx.setLineDash([]);
        
        // 중앙선
        this.celestialCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.celestialCtx.lineWidth = 1;
        this.celestialCtx.beginPath();
        this.celestialCtx.moveTo(0, beltY);
        this.celestialCtx.lineTo(canvasWidth, beltY);
        this.celestialCtx.stroke();
        
        // 간단한 라벨
        this.celestialCtx.fillStyle = '#4fc3f7';
        this.celestialCtx.font = '11px Noto Sans KR';
        this.celestialCtx.textAlign = 'left';
        this.celestialCtx.fillText('배경별 (고정)', 10, 15);
        this.celestialCtx.fillText('← 별들의 좌우 움직임 관찰 →', canvasWidth/2 - 80, 15);
    }
    
    drawCelestialBackgroundStars() {
        // 배경별들 그리기 (완전 고정 위치)
        this.celestialData.backgroundStarPositions.forEach((star, index) => {
            const x = (star.angle / 360) * (this.celestialCanvas.width / window.devicePixelRatio);
            // 고정된 y 위치 (진동 제거)
            const y = this.celestialCenterY + ((index % 3) - 1) * 20; // -20, 0, +20 으로 3줄 배치
            
            this.celestialCtx.globalAlpha = star.brightness * 0.6;
            this.celestialCtx.fillStyle = '#ffffff';
            this.celestialCtx.beginPath();
            this.celestialCtx.arc(x, y, star.size, 0, Math.PI * 2);
            this.celestialCtx.fill();
        });
        
        this.celestialCtx.globalAlpha = 1;
    }
    
    drawCelestialTargetStars() {
        // 별 X 그리기
        const starXPos = this.angleToPosition(this.celestialData.starX.angle);
        this.celestialCtx.fillStyle = this.stars.X.color;
        this.celestialCtx.shadowColor = this.stars.X.color;
        this.celestialCtx.shadowBlur = 15;
        this.celestialCtx.beginPath();
        this.celestialCtx.arc(starXPos.x, starXPos.y, 8, 0, Math.PI * 2);
        this.celestialCtx.fill();
        
        // 별 X 내부 밝은 점
        this.celestialCtx.fillStyle = '#ffffff';
        this.celestialCtx.shadowBlur = 0;
        this.celestialCtx.beginPath();
        this.celestialCtx.arc(starXPos.x, starXPos.y, 3, 0, Math.PI * 2);
        this.celestialCtx.fill();
        
        // 별 X 라벨
        this.celestialCtx.fillStyle = '#ffffff';
        this.celestialCtx.font = 'bold 11px Noto Sans KR';
        this.celestialCtx.textAlign = 'center';
        this.celestialCtx.fillText('X', starXPos.x, starXPos.y - 12);
        
        // 별 Y 그리기
        const starYPos = this.angleToPosition(this.celestialData.starY.angle);
        this.celestialCtx.fillStyle = this.stars.Y.color;
        this.celestialCtx.shadowColor = this.stars.Y.color;
        this.celestialCtx.shadowBlur = 10;
        this.celestialCtx.beginPath();
        this.celestialCtx.arc(starYPos.x, starYPos.y, 5, 0, Math.PI * 2);
        this.celestialCtx.fill();
        
        // 별 Y 내부 밝은 점
        this.celestialCtx.fillStyle = '#ffffff';
        this.celestialCtx.shadowBlur = 0;
        this.celestialCtx.beginPath();
        this.celestialCtx.arc(starYPos.x, starYPos.y, 2, 0, Math.PI * 2);
        this.celestialCtx.fill();
        
        // 별 Y 라벨
        this.celestialCtx.fillStyle = '#ffffff';
        this.celestialCtx.font = 'bold 11px Noto Sans KR';
        this.celestialCtx.textAlign = 'center';
        this.celestialCtx.fillText('Y', starYPos.x, starYPos.y - 10);
    }
    
    angleToPosition(angle) {
        // 각도를 천구 캔버스 위치로 변환
        const x = ((angle % 360) / 360) * (this.celestialCanvas.width / window.devicePixelRatio);
        const y = this.celestialCenterY;
        return { x, y };
    }
    
    updateCelestialUI() {
        // 천구 정보 패널이 제거되었으므로 UI 업데이트 불필요
        // 필요시 캔버스 내에 정보 표시 가능
    }
}

// 페이지 로드 시 시뮬레이터 시작
document.addEventListener('DOMContentLoaded', () => {
    new ParallaxSimulator();
});