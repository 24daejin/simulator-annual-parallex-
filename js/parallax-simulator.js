// 연주시차 시뮬레이터 JavaScript

class ParallaxSimulator {
    constructor() {
        // 조감도 캔버스
        this.canvas = document.getElementById('parallaxCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 전체 배치 조감도 캔버스
        this.overviewCanvas = document.getElementById('overviewCanvas');
        this.overviewCtx = this.overviewCanvas.getContext('2d');

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
        this.earthOrbitRadius = 40;
        // 조감도 축척: 1pc당 픽셀 수 (모든 거리에 같은 축척을 적용해 시차각 비율을 유지)
        this.pxPerParsec = 96;
        // 이 높이보다 위로 넘어가는 별은 '화면 밖'으로 표시
        this.visibleTopY = 90;
        
        // A/B점 도달 감지 및 강조 효과
        this.highlightEffect = {
            isActive: false,
            intensity: 0,
            targetStar: null
        };
        
        // 천구 시뮬레이터 데이터
        this.celestialData = {
            // 천구상 별 위치 (각도 단위)
            starS: { angle: 0, baseAngle: 0 },
            starT: { angle: 0, baseAngle: 0 },
            // 배경별들의 기준 위치
            backgroundStarPositions: []
        };
        
        this.initializeCelestialSphere();
        
        // 별 데이터 (태양-별 S-별 T 완전 일직선 배치)
        // y 좌표는 updateStarPositions()에서 거리(pc) × 축척으로 계산
        this.stars = {
            S: {
                distance: 2.0, // parsecs
                x: 0,    // 태양과 같은 x좌표 (일직선)
                y: 0,
                parallax: 0,
                color: '#ffeb3b' // 밝은 노란색
            },
            T: {
                distance: 20.0, // parsecs
                x: 0,    // 태양과 같은 x좌표 (일직선)
                y: 0,
                parallax: 0,
                color: '#ff9800' // 주황색
            }
        };

        // 배경별들
        this.backgroundStars = [];
        this.generateBackgroundStars();
        
        // 지구 위치 (조감도 시점)
        this.earthPos = { x: 0, y: 0 };
        this.earthPhase = 0; // A점(태양 왼쪽)에서 시작, 반시계방향 공전
        
        // 조감도 시점 (위에서 내려다보는 시각)
        this.viewMode = 'topDown'; // 'topDown' 모드
        
        // 시선 방향과 시차각 표시용
        this.sightLines = {
            S: { fromA: {angle: 0}, fromB: {angle: 0}, parallaxAngle: 0 },
            T: { fromA: {angle: 0}, fromB: {angle: 0}, parallaxAngle: 0 }
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
        
        // 별 S, T의 기준 각도 설정 (중앙 부근)
        this.celestialData.starS.baseAngle = 180; // 중앙
        this.celestialData.starT.baseAngle = 180; // 중앙 (같은 일직선상)
    }
    
    resizeCanvas() {
        // 조감도 캔버스 크기 설정
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        this.centerX = rect.width / 2;
        this.centerY = rect.height / 2;
        this.canvasWidth = rect.width;
        this.canvasHeight = rect.height;
        // 별이 위쪽으로 멀리 놓일 수 있도록 태양을 아래쪽에 배치
        this.sunY = rect.height - 130;
        
        // 전체 배치 조감도 캔버스 크기 설정
        const overviewRect = this.overviewCanvas.getBoundingClientRect();
        this.overviewCanvas.width = overviewRect.width * window.devicePixelRatio;
        this.overviewCanvas.height = overviewRect.height * window.devicePixelRatio;
        this.overviewCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.overviewWidth = overviewRect.width;
        this.overviewHeight = overviewRect.height;

        // 천구 캔버스 크기 설정
        const celestialRect = this.celestialCanvas.getBoundingClientRect();
        this.celestialCanvas.width = celestialRect.width * window.devicePixelRatio;
        this.celestialCanvas.height = celestialRect.height * window.devicePixelRatio;
        this.celestialCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        this.celestialCenterX = celestialRect.width / 2;
        this.celestialHeight = celestialRect.height;
        // 배경별 줄의 중심 (위쪽은 별 S, 아래쪽은 별 T 자리)
        this.celestialCenterY = celestialRect.height * 0.56;
    }
    
    generateBackgroundStars() {
        this.backgroundStars = [];
        // 배경별은 대상 별들보다 훨씬 멀리 있으므로 화면 맨 위쪽 띠에만 배치
        // x는 캔버스 폭 대비 비율(0~1), y는 캔버스 상단에서의 픽셀
        for (let i = 0; i < 120; i++) {
            this.backgroundStars.push({
                x: Math.random(),
                y: Math.random() * 32 + 8,
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
        const starSSlider = document.getElementById('starSDistanceSlider');
        starSSlider.addEventListener('input', () => {
            this.stars.S.distance = parseFloat(starSSlider.value);
            document.getElementById('starSDistanceValue').textContent = this.stars.S.distance.toFixed(1);
            this.updateStarPositions();
            this.updateUI();
        });
        
        const starTSlider = document.getElementById('starTDistanceSlider');
        starTSlider.addEventListener('input', () => {
            this.stars.T.distance = parseFloat(starTSlider.value);
            document.getElementById('starTDistanceValue').textContent = this.stars.T.distance.toFixed(1);
            this.updateStarPositions();
            this.updateUI();
        });
        
        // 초기 UI 업데이트
        this.updateUI();
    }
    
    updateEarthPosition() {
        // 반시계방향 공전: A점(phase 0, 태양 왼쪽) -> B점(phase π, 태양 오른쪽) -> A점
        if (this.isPlaying) {
            this.earthPhase += 0.02 * this.animationSpeed; // 연속적인 공전
            if (this.earthPhase >= 2 * Math.PI) {
                this.earthPhase = 0; // 한 바퀴 완성 후 리셋
            }
        }
        
        // 화면상 반시계방향: 왼쪽(A) -> 아래 -> 오른쪽(B) -> 위 -> 왼쪽 (캔버스 y축은 아래가 +)
        this.earthPos.x = -this.earthOrbitRadius * Math.cos(this.earthPhase);
        this.earthPos.y = this.earthOrbitRadius * Math.sin(this.earthPhase);
    }
    
    updateStarPositions() {
        // 연주시차 계산 (거리와 반비례)
        // 연주시차 (초각) = 1 / 거리 (파섹)
        this.stars.S.parallax = 1 / this.stars.S.distance;
        this.stars.T.parallax = 1 / this.stars.T.distance;

        // 조감도상 위치: 거리에 비례 (같은 축척이므로 그림 속 시차각도 1/거리에 비례)
        this.stars.S.y = -this.stars.S.distance * this.pxPerParsec;
        this.stars.T.y = -this.stars.T.distance * this.pxPerParsec;

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
        const earthPosA = { x: -this.earthOrbitRadius, y: 0 }; // A점 (태양 왼쪽)
        const earthPosB = { x: this.earthOrbitRadius, y: 0 }; // B점 (태양 오른쪽)
        
        // 별 S에 대한 시선 각도
        this.sightLines.S.fromA.angle = Math.atan2(this.stars.S.y - earthPosA.y, this.stars.S.x - earthPosA.x);
        this.sightLines.S.fromB.angle = Math.atan2(this.stars.S.y - earthPosB.y, this.stars.S.x - earthPosB.x);
        this.sightLines.S.parallaxAngle = Math.abs(this.sightLines.S.fromA.angle - this.sightLines.S.fromB.angle);
        
        // 별 T에 대한 시선 각도
        this.sightLines.T.fromA.angle = Math.atan2(this.stars.T.y - earthPosA.y, this.stars.T.x - earthPosA.x);
        this.sightLines.T.fromB.angle = Math.atan2(this.stars.T.y - earthPosB.y, this.stars.T.x - earthPosB.x);
        this.sightLines.T.parallaxAngle = Math.abs(this.sightLines.T.fromA.angle - this.sightLines.T.fromB.angle);
    }
    
    project2D(x, y) {
        // 조감도 시점: 태양 기준 2D 좌표를 캔버스 좌표로 변환
        return {
            x: this.centerX + x,
            y: this.sunY + y
        };
    }

    isOffScreen(pos) {
        return pos.y < this.visibleTopY;
    }
    
    drawSun() {
        const sunPos = this.project2D(0, 0);
        
        // 태양 그리기 (조감도 시점)
        this.ctx.fillStyle = '#ffd700';
        this.ctx.shadowColor = '#ffd700';
        this.ctx.shadowBlur = 25;
        this.ctx.beginPath();
        this.ctx.arc(sunPos.x, sunPos.y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // 태양 라벨 (위쪽은 시선·호가 지나가므로 아래에 표시)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 13px Noto Sans KR';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('태양', sunPos.x, sunPos.y + 28);
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
        const pointA = this.project2D(-this.earthOrbitRadius, 0); // 태양 왼쪽
        const pointB = this.project2D(this.earthOrbitRadius, 0);  // 태양 오른쪽
        
        // A점 표시
        this.ctx.fillStyle = 'rgba(79, 195, 247, 0.8)';
        this.ctx.beginPath();
        this.ctx.arc(pointA.x, pointA.y, 5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 13px Noto Sans KR';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('A점', pointA.x, pointA.y + 22);
        
        // B점 표시
        this.ctx.fillStyle = 'rgba(79, 195, 247, 0.8)';
        this.ctx.beginPath();
        this.ctx.arc(pointB.x, pointB.y, 5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('B점', pointB.x, pointB.y + 22);
        
        // 이등변삼각형 표시를 위한 보조선 (희미하게)
        const starSPos = this.project2D(this.stars.S.x, this.stars.S.y);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([3, 3]);
        
        // A점-별 S, B점-별 S 연결선 (이등변삼각형)
        this.ctx.beginPath();
        this.ctx.moveTo(pointA.x, pointA.y);
        this.ctx.lineTo(starSPos.x, starSPos.y);
        this.ctx.moveTo(pointB.x, pointB.y);
        this.ctx.lineTo(starSPos.x, starSPos.y);
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
        
        // 공전궤도 바깥쪽에 라벨 표시 (궤도 안쪽은 태양·호와 겹침)
        // 지구가 왼쪽/오른쪽에 있으면 라벨을 그 바깥으로 정렬해 A점·B점 라벨과 겹치지 않게 함
        const outward = Math.atan2(this.earthPos.y, this.earthPos.x);
        const dirX = Math.cos(outward);
        this.ctx.textAlign = dirX < -0.3 ? 'right' : dirX > 0.3 ? 'left' : 'center';
        this.ctx.fillText(positionLabel, earthPos.x + 16 * dirX, earthPos.y + 22 * Math.sin(outward) + 4);
    }
    
    drawStars() {
        this.drawTargetStar('S', 10, 3, 20);
        this.drawTargetStar('T', 8, 2, 15);
    }

    drawTargetStar(name, radius, coreRadius, glow) {
        const star = this.stars[name];
        const pos = this.project2D(star.x, star.y);
        const label = `별 ${name} (${star.distance.toFixed(1)}pc)`;

        // 화면 위로 넘어간 별: 실제 위치 대신 상단에 방향 표시
        if (this.isOffScreen(pos)) {
            this.drawOffScreenMarker(name, pos.x, label);
            return;
        }

        this.ctx.fillStyle = star.color;
        this.ctx.shadowColor = star.color;
        this.ctx.shadowBlur = glow;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // 내부 밝은 점
        this.ctx.fillStyle = '#ffffff';
        this.ctx.shadowBlur = 0;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, coreRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // 라벨
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 13px Noto Sans KR';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(label, pos.x, pos.y - radius - 10);
    }

    drawOffScreenMarker(name, x, label) {
        const star = this.stars[name];
        // 별 S는 왼쪽, 별 T는 오른쪽에 라벨을 두어 둘 다 화면 밖이어도 겹치지 않게 함
        const side = name === 'S' ? -1 : 1;
        const markerX = x + side * 6;
        const markerY = this.visibleTopY - 15;

        // 위쪽 화살촉
        this.ctx.fillStyle = star.color;
        this.ctx.beginPath();
        this.ctx.moveTo(markerX, markerY - 8);
        this.ctx.lineTo(markerX - 6, markerY + 4);
        this.ctx.lineTo(markerX + 6, markerY + 4);
        this.ctx.closePath();
        this.ctx.fill();

        // 라벨은 A·B점에서 올라가는 시선보다 바깥쪽에 배경과 함께 표시
        const line1 = `${label} ↑ 화면 밖 (전체 배치 참고)`;
        const line2 = `연주시차 ${star.parallax.toFixed(3)}"`;
        const textX = x + side * (this.earthOrbitRadius + 16);
        this.ctx.font = 'bold 12px Noto Sans KR';
        const boxWidth = Math.max(this.ctx.measureText(line1).width, 130) + 12;
        const boxX = side < 0 ? textX - boxWidth + 6 : textX - 6;
        this.ctx.fillStyle = 'rgba(0, 4, 40, 0.85)';
        this.ctx.fillRect(boxX, markerY - 14, boxWidth, 34);

        this.ctx.fillStyle = star.color;
        this.ctx.textAlign = side < 0 ? 'right' : 'left';
        this.ctx.fillText(line1, textX, markerY);
        this.ctx.font = 'bold 11px Courier New';
        this.ctx.fillText(line2, textX, markerY + 14);
    }

    drawBackgroundStars() {
        // 배경별: 화면 맨 위 띠 (대상 별들보다 훨씬 먼 거리)
        this.backgroundStars.forEach(star => {
            this.ctx.globalAlpha = star.brightness * 0.7;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(star.x * this.canvasWidth, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });

        this.ctx.globalAlpha = 1;

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.font = '11px Noto Sans KR';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('↑ 배경별 (매우 먼 거리 — 실제로는 화면보다 훨씬 위)', this.centerX, 52);
    }
    
    drawSightLines() {
        // 현재 지구에서 별들로의 시선 라인
        const earthPos = this.project2D(this.earthPos.x, this.earthPos.y);
        const starSPos = this.project2D(this.stars.S.x, this.stars.S.y);
        const starTPos = this.project2D(this.stars.T.x, this.stars.T.y);
        
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
        
        // 지구에서 별 S로
        this.ctx.beginPath();
        this.ctx.moveTo(earthPos.x, earthPos.y);
        this.ctx.lineTo(starSPos.x, starSPos.y);
        this.ctx.stroke();
        
        // 지구에서 별 T로
        this.ctx.beginPath();
        this.ctx.moveTo(earthPos.x, earthPos.y);
        this.ctx.lineTo(starTPos.x, starTPos.y);
        this.ctx.stroke();
        
        // 그림자 효과 리셋
        this.ctx.shadowBlur = 0;
        
        this.ctx.setLineDash([]);
        
        // 화살표 그리기
        this.drawArrow(earthPos, starSPos, '#ffeb3b');
        this.drawArrow(earthPos, starTPos, '#ff9800');
    }
    
    drawArrow(from, to, color) {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const length = 20;
        const arrowSize = 8;
        
        // 화살표 위치 (지구에서 일정 거리 — 별이 화면 밖에 있어도 보이도록)
        const midX = from.x + 60 * Math.cos(angle);
        const midY = from.y + 60 * Math.sin(angle);
        
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
        const pointA = this.project2D(-this.earthOrbitRadius, 0); // 태양 왼쪽
        const pointB = this.project2D(this.earthOrbitRadius, 0);  // 태양 오른쪽
        const starSPos = this.project2D(this.stars.S.x, this.stars.S.y);
        const starTPos = this.project2D(this.stars.T.x, this.stars.T.y);
        const sunPos = this.project2D(0, 0);
        
        // 태양-별 S-별 T 일직선 강조
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(sunPos.x, sunPos.y);
        this.ctx.lineTo(starSPos.x, starSPos.y);
        this.ctx.lineTo(starTPos.x, starTPos.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // 별 S에 대한 연주시차 호 그리기 (태양 중심)
        this.drawParallaxArcCorrect(pointA, pointB, starSPos, '#ffeb3b', 'S');
        
        // 별 T에 대한 연주시차 호 그리기 (태양 중심)
        this.drawParallaxArcCorrect(pointA, pointB, starTPos, '#ff9800', 'T');
        
        // A점과 B점에서의 시선 방향 (희미하게)
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([3, 3]);
        
        // A점에서 별들로
        this.ctx.beginPath();
        this.ctx.moveTo(pointA.x, pointA.y);
        this.ctx.lineTo(starSPos.x, starSPos.y);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(pointA.x, pointA.y);
        this.ctx.lineTo(starTPos.x, starTPos.y);
        this.ctx.stroke();
        
        // B점에서 별들로
        this.ctx.beginPath();
        this.ctx.moveTo(pointB.x, pointB.y);
        this.ctx.lineTo(starSPos.x, starSPos.y);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(pointB.x, pointB.y);
        this.ctx.lineTo(starTPos.x, starTPos.y);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
    }
    
    drawParallaxArcCorrect(pointA, pointB, star, color, starName) {
        // 정확한 연주시차: 태양-별-지구(A점)이 이루는 각도 (별을 꼭짓점으로)
        // 화면 밖 별은 호 대신 상단 표시에 시차값을 보여줌
        if (this.isOffScreen(star)) return;

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
        
        // 연주시차 라벨 (별 오른쪽 옆, 배경 상자로 시선과 겹쳐도 읽히게)
        const labelX = star.x + 18;
        const labelY = star.y + 4;

        this.ctx.fillStyle = 'rgba(0, 4, 40, 0.8)';
        this.ctx.fillRect(labelX - 4, labelY - 13, 72, 32);

        this.ctx.fillStyle = color;
        this.ctx.font = 'bold 12px Noto Sans KR';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`연주시차 ${starName}`, labelX, labelY);
        
        // 연주시차 = 1/거리 (초각 단위)
        const parallaxArcsec = 1 / (starName === 'S' ? this.stars.S.distance : this.stars.T.distance);
        this.ctx.font = 'bold 11px Courier New';
        this.ctx.fillText(`${parallaxArcsec.toFixed(3)}"`, labelX, labelY + 14);
    }
    
    drawOverview() {
        // 전체 배치 조감도: 가장 먼 별까지 한 화면에 들어오도록 축척을 자동 조절
        const ctx = this.overviewCtx;
        const W = this.overviewWidth;
        const H = this.overviewHeight;
        ctx.fillStyle = 'rgb(0, 4, 40)';
        ctx.fillRect(0, 0, W, H);

        // 배경별 띠 (확대 조감도와 동일)
        this.backgroundStars.forEach(star => {
            ctx.globalAlpha = star.brightness * 0.7;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(star.x * W, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '11px Noto Sans KR';
        ctx.textAlign = 'center';
        ctx.fillText('↑ 배경별 (매우 먼 거리 — 실제로는 화면보다 훨씬 위)', W / 2, 52);

        const sunX = W / 2;
        const sunY = H - 60;
        const topY = 100;
        const maxDistance = Math.max(this.stars.S.distance, this.stars.T.distance);
        const pxPerParsec = (sunY - topY) / maxDistance;
        // 확대 조감도 좌표 → 전체 조감도 좌표 배율
        const scale = pxPerParsec / this.pxPerParsec;
        const toOverview = (x, y) => ({ x: sunX + x * scale, y: sunY + y * scale });

        // 확대 조감도가 보여주는 범위
        const boxLeft = sunX - this.centerX * scale;
        const boxTop = sunY - this.sunY * scale;
        const boxWidth = this.canvasWidth * scale;
        const boxHeight = this.canvasHeight * scale;
        ctx.fillStyle = 'rgba(79, 195, 247, 0.08)';
        ctx.fillRect(boxLeft, boxTop, boxWidth, boxHeight);
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(boxLeft, boxTop, boxWidth, boxHeight);
        ctx.setLineDash([]);
        ctx.fillStyle = '#4fc3f7';
        ctx.font = 'bold 11px Noto Sans KR';
        ctx.textAlign = 'left';
        ctx.fillText('확대 조감도 범위', Math.min(boxLeft + boxWidth + 6, W - 100), Math.max(boxTop + 12, topY));

        const pointA = toOverview(-this.earthOrbitRadius, 0);
        const pointB = toOverview(this.earthOrbitRadius, 0);
        const starPositions = {
            S: toOverview(0, this.stars.S.y),
            T: toOverview(0, this.stars.T.y)
        };

        // 태양-별 일직선
        const farthest = this.stars.S.distance > this.stars.T.distance ? starPositions.S : starPositions.T;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        ctx.lineTo(farthest.x, farthest.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // A점·B점에서 각 별로의 시선
        ['S', 'T'].forEach(name => {
            const pos = starPositions[name];
            ctx.strokeStyle = this.stars[name].color;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(pointA.x, pointA.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.moveTo(pointB.x, pointB.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
        });

        // 공전궤도 (이 축척에서는 매우 작음)
        const orbitRadius = Math.max(this.earthOrbitRadius * scale, 1.5);
        ctx.strokeStyle = 'rgba(79, 195, 247, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sunX, sunY, orbitRadius, 0, Math.PI * 2);
        ctx.stroke();

        // 태양
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(sunX, sunY, Math.min(4, orbitRadius * 0.6), 0, Math.PI * 2);
        ctx.fill();

        // 지구
        const earth = toOverview(this.earthPos.x, this.earthPos.y);
        ctx.fillStyle = '#4fc3f7';
        ctx.beginPath();
        ctx.arc(earth.x, earth.y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 11px Noto Sans KR';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText('A', sunX - orbitRadius - 6, sunY + 4);
        ctx.textAlign = 'left';
        ctx.fillText('B', sunX + orbitRadius + 6, sunY + 4);
        ctx.textAlign = 'center';
        ctx.fillText('태양 · 공전궤도', sunX, sunY + orbitRadius + 18);

        // 별 S, T
        ['S', 'T'].forEach(name => {
            const star = this.stars[name];
            const pos = starPositions[name];
            ctx.fillStyle = star.color;
            ctx.shadowColor = star.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, name === 'S' ? 6 : 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Noto Sans KR';
            ctx.textAlign = 'left';
            ctx.fillText(`별 ${name} (${star.distance.toFixed(1)}pc)`, pos.x + 12, pos.y + 4);
        });

        // 안내 문구
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.font = '11px Noto Sans KR';
        ctx.textAlign = 'center';
        ctx.fillText('이 축척에서는 시차각이 너무 작아 A·B점의 시선이 거의 겹쳐 보여요', W / 2, 72);

        this.drawScaleBar(ctx, pxPerParsec, H);
    }

    drawScaleBar(ctx, pxPerParsec, canvasHeight) {
        // 축척 막대: 50px 이상이 되는 가장 작은 '깔끔한' 길이 선택
        const lengths = [0.5, 1, 2, 5, 10, 20, 50, 100];
        const length = lengths.find(l => l * pxPerParsec >= 50) || lengths[lengths.length - 1];
        const barWidth = length * pxPerParsec;
        const x = 16;
        const y = canvasHeight - 20;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y);
        ctx.lineTo(x + barWidth, y);
        ctx.lineTo(x + barWidth, y - 5);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Noto Sans KR';
        ctx.textAlign = 'left';
        ctx.fillText(`축척 ${length} pc`, x + barWidth + 8, y + 4);
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
        document.getElementById('starSParallax').textContent = `${this.stars.S.parallax.toFixed(3)}"`;
        document.getElementById('starTParallax').textContent = `${this.stars.T.parallax.toFixed(3)}"`;
        
        // 거리 표시
        document.getElementById('starSDistance').textContent = `${this.stars.S.distance.toFixed(1)} pc`;
        document.getElementById('starTDistance').textContent = `${this.stars.T.distance.toFixed(1)} pc`;
    }
    
    animate() {
        // 캔버스 클리어 (조감도 시점용 배경)
        // 반투명으로 덮으면 별 위치를 바꿨을 때 이전 위치의 잔상이 남으므로 완전히 지움
        this.ctx.fillStyle = 'rgb(0, 4, 40)';
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
        this.drawScaleBar(this.ctx, this.pxPerParsec, this.canvasHeight);

        // 전체 배치 조감도 그리기
        this.drawOverview();
        
        // UI 업데이트
        this.updateUI();
        
        // 천구 시뮬레이터 그리기
        this.drawCelestialSphere();
        
        requestAnimationFrame(() => this.animate());
    }
    
    calculateCelestialPositions() {
        // 지구 위치에 따른 천구상 별 위치 계산
        // 연주시차 효과: 지구가 A점일 때와 B점일 때의 각도 차이
        
        // 화면 폭의 8%를 최대 이동 폭(한쪽)으로 제한 (화면 이탈 방지)
        const screenWidth = this.celestialCanvas.width / window.devicePixelRatio;
        const maxOffset = screenWidth * 0.08;
        
        ['S', 'T'].forEach(name => {
            const data = this.celestialData['star' + name];
            // 한쪽 이동 폭(픽셀) = 연주시차 p에 비례 (시각적 효과를 위한 배율 50)
            data.amplitude = Math.min(this.stars[name].parallax * 50, maxOffset);
            // 지구가 A점(태양 왼쪽)에 있으면 가까운 별은 배경별보다 오른쪽에 보임
            const offset = data.amplitude * Math.cos(this.earthPhase);
            
            const basePixel = (data.baseAngle / 360) * screenWidth;
            data.angle = ((basePixel + offset) / screenWidth) * 360;
        });
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
            const y = this.celestialCenterY + ((index % 3) - 1) * 10; // -10, 0, +10 으로 3줄 배치
            
            this.celestialCtx.globalAlpha = star.brightness * 0.6;
            this.celestialCtx.fillStyle = '#ffffff';
            this.celestialCtx.beginPath();
            this.celestialCtx.arc(x, y, star.size, 0, Math.PI * 2);
            this.celestialCtx.fill();
        });
        
        this.celestialCtx.globalAlpha = 1;
    }
    
    drawCelestialTargetStars() {
        // 두 별을 서로 다른 높이에 그려 겹치지 않게 함 (별 S는 배경별 줄 위, 별 T는 아래)
        this.drawCelestialTargetStar('S', 40, 8, 3, 15);
        this.drawCelestialTargetStar('T', this.celestialHeight - 32, 5, 2, 10);
    }
    
    drawCelestialTargetStar(name, rowY, radius, coreRadius, glow) {
        const ctx = this.celestialCtx;
        const star = this.stars[name];
        const data = this.celestialData['star' + name];
        const canvasWidth = this.celestialCanvas.width / window.devicePixelRatio;
        const baseX = (data.baseAngle / 360) * canvasWidth;
        const amp = data.amplitude;
        
        // 1년 동안의 이동 범위: 오른쪽 끝 = A점에서 본 위치, 왼쪽 끝 = B점에서 본 위치
        ctx.strokeStyle = star.color;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        [baseX - amp, baseX + amp].forEach(x => {
            ctx.beginPath();
            ctx.arc(x, rowY, radius, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.globalAlpha = 1;
        
        // 이동 폭 = 2p 브래킷 (가운데 눈금 = 태양에서 본 방향)
        const bracketY = rowY + radius + 8;
        ctx.strokeStyle = star.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(baseX - amp, bracketY - 4);
        ctx.lineTo(baseX - amp, bracketY);
        ctx.lineTo(baseX + amp, bracketY);
        ctx.lineTo(baseX + amp, bracketY - 4);
        ctx.moveTo(baseX, bracketY);
        ctx.lineTo(baseX, bracketY + 3);
        ctx.stroke();
        
        // 브래킷 양 끝 라벨 (폭이 좁으면 생략)
        if (amp > 14) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '10px Noto Sans KR';
            ctx.textAlign = 'center';
            ctx.fillText('B점', baseX - amp, bracketY + 12);
            ctx.fillText('A점', baseX + amp, bracketY + 12);
        }
        
        // 이동 폭 설명: 오른쪽에 표시 (폭이 아주 좁아도 읽히도록)
        const p = star.parallax;
        ctx.fillStyle = star.color;
        ctx.font = 'bold 11px Noto Sans KR';
        ctx.textAlign = 'left';
        const textX = baseX + Math.max(amp, radius) + 14;
        ctx.fillText(`별 ${name}: A↔B 이동 폭 = 2p = ${(2 * p).toFixed(3)}"`, textX, rowY - 2);
        ctx.font = '10px Noto Sans KR';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(`연주시차 p는 그 절반 = ${p.toFixed(3)}"`, textX, rowY + 11);
        
        // 현재 별 위치
        const pos = { x: this.angleToPosition(data.angle).x, y: rowY };
        ctx.fillStyle = star.color;
        ctx.shadowColor = star.color;
        ctx.shadowBlur = glow;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 내부 밝은 점
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, coreRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 라벨
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Noto Sans KR';
        ctx.textAlign = 'center';
        ctx.fillText(name, pos.x, pos.y - radius - 4);
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