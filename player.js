// === 音乐播放器核心逻辑 ===
class VistaPlayer {
    constructor(config) {
        this.playlist = config.playlist || [];
        this.currentIndex = config.startIndex || 0;
        this.audio = new Audio();
        this.audio.preload = 'metadata';

        // DOM 元素缓存
        this.els = {
            cover: document.querySelector('.media-player .cover'),
            playBtn: document.querySelector('.media-player .controls button:nth-child(2)'),
            prevBtn: document.querySelector('.media-player .controls button:nth-child(1)'),
            nextBtn: document.querySelector('.media-player .controls button:nth-child(3)'),
            playlist: document.querySelector('.media-player .playlist'),
            info: document.querySelector('.media-player .info'),
            // 进度条相关
            progressBar: document.querySelector('.media-player .progress-bar'),
            currentTimeEl: document.querySelector('.media-player .current-time'),
            durationEl: document.querySelector('.media-player .duration'),
        };

        this.isPlaying = false;
        this.init();
    }

    init() {
        this.renderPlaylist();
        this.loadTrack(this.currentIndex);
        this.bindEvents();
    }

    // 渲染播放列表
    renderPlaylist() {
        this.els.playlist.innerHTML = '';
        this.playlist.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = `track${index === this.currentIndex ? ' active' : ''}`;
            item.textContent = track.title;
            item.dataset.index = index;
            item.addEventListener('click', () => this.playTrack(index));
            this.els.playlist.appendChild(item);
        });
    }

    // 加载指定歌曲
    loadTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;
        this.currentIndex = index;
        const track = this.playlist[index];

        this.audio.src = track.src;
        this.audio.load();

        // 更新 UI 文字
        this.els.info.textContent = `${track.title} — ${track.artist || '未知艺术家'}`;
        this.updatePlayButton();
        this.highlightTrack(index);
        
        // 重置进度条显示
        this.els.progressBar.value = 0;
        this.els.currentTimeEl.textContent = '0:00';
        this.els.durationEl.textContent = '0:00';
        this.updateProgressFill();

        // ★ 核心修复：读取封面改为异步静默执行，绝不阻塞音频加载
        this.renderCover(track.src);
    }

    // 播放指定歌曲
    playTrack(index) {
        this.loadTrack(index);
        this.audio.play()
            .then(() => {
                this.isPlaying = true;
                this.updatePlayButton();
            })
            .catch(err => console.warn('播放失败:', err));
    }

    // 切换播放/暂停
    togglePlay() {
        if (this.audio.paused) {
            this.audio.play()
                .then(() => {
                    this.isPlaying = true;
                    this.updatePlayButton();
                })
                .catch(err => console.warn('播放失败:', err));
        } else {
            this.audio.pause();
            this.isPlaying = false;
            this.updatePlayButton();
        }
    }

    // 上一首
    prevTrack() {
        const newIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.playlist.length - 1;
        this.playTrack(newIndex);
    }

    // 下一首
    nextTrack() {
        const newIndex = this.currentIndex < this.playlist.length - 1 ? this.currentIndex + 1 : 0;
        this.playTrack(newIndex);
    }

    // 更新播放按钮图标
    updatePlayButton() {
        this.els.playBtn.textContent = this.isPlaying ? '⏸' : '▶';
    }

    // 高亮当前播放曲目
    highlightTrack(index) {
        const items = this.els.playlist.querySelectorAll('.track');
        items.forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
        // 自动滚动到可视区域
        items[index]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // 格式化时间
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // 更新进度条填充（WMP 风格渐变）
    updateProgressFill() {
        const bar = this.els.progressBar;
        // 防止除以 0 报错
        if (!this.audio.duration) return;
        const percent = (this.audio.currentTime / this.audio.duration) * 100;
        // 用 linear-gradient 模拟 WMP 已播放部分的青蓝渐变
        bar.style.background = `linear-gradient(to right, 
            #3da8d4 0%, 
            #8be0ff ${percent}%, 
            rgba(0,0,0,0.35) ${percent}%, 
            rgba(0,0,0,0.35) 100%)`;
    }

    // ★ 修复后：读取 MP3 封面（增加严格容错，绝不阻塞主流程）
    renderCover(src) {
        const coverEl = this.els.cover;
        // 1. 先显示默认图标，防止切歌时上一首的封面残留
        coverEl.innerHTML = '🎵'; 

        // 2. 检查库是否加载成功
        if (!window.jsmediatags) {
            console.warn('jsmediatags 库未加载，跳过封面读取');
            return;
        }

        // 3. 异步读取，放在 try-catch 中防止意外崩溃
        try {
            window.jsmediatags.read(src, {
                onSuccess: (tag) => {
                    const tags = tag.tags;
                    // 检查是否有图片数据 (picture)
                    if (tags.picture) {
                        const { data, format } = tags.picture;
                        // 将二进制数据转换为 base64 字符串
                        let base64String = "";
                        for (let i = 0; i < data.length; i++) {
                            base64String += String.fromCharCode(data[i]);
                        }
                        const base64 = `data:${format};base64,${window.btoa(base64String)}`;
                        
                        // 创建 img 标签并插入
                        const img = document.createElement('img');
                        img.src = base64;
                        img.alt = "Album Cover";
                        coverEl.innerHTML = ''; // 清空默认图标
                        coverEl.appendChild(img);
                    }
                },
                onError: (error) => {
                    // 读取失败静默处理，保持默认图标 🎵，不影响播放
                    console.warn('封面读取失败（可能是本地文件跨域限制）:', error.type);
                }
            });
        } catch (e) {
            console.error('封面读取发生未知错误:', e);
        }
    }

    // 绑定事件
    bindEvents() {
        this.els.playBtn.addEventListener('click', () => this.togglePlay());
        this.els.prevBtn.addEventListener('click', () => this.prevTrack());
        this.els.nextBtn.addEventListener('click', () => this.nextTrack());

        // 歌曲结束自动下一首
        this.audio.addEventListener('ended', () => this.nextTrack());

        // 进度条拖动
        this.els.progressBar.addEventListener('input', () => {
            const time = (this.els.progressBar.value / 100) * this.audio.duration;
            this.audio.currentTime = time;
            this.els.currentTimeEl.textContent = this.formatTime(time);
        });

        // 音频时间更新
        this.audio.addEventListener('timeupdate', () => {
            if (!this.audio.duration) return;
            const percent = (this.audio.currentTime / this.audio.duration) * 100;
            this.els.progressBar.value = percent;
            this.els.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
            this.updateProgressFill();
        });

        // 元数据加载完成（获取总时长）
        this.audio.addEventListener('loadedmetadata', () => {
            this.els.durationEl.textContent = this.formatTime(this.audio.duration);
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePlay();
            } else if (e.code === 'ArrowLeft') {
                this.prevTrack();
            } else if (e.code === 'ArrowRight') {
                this.nextTrack();
            }
        });
    }
}

// === 初始化播放器 ===
document.addEventListener('DOMContentLoaded', () => {
    const player = new VistaPlayer({
        startIndex: 0,
        playlist: [
            {
                title: '反乌托邦Pt.2',
                artist: '亞細亞曠世奇才/洛天依Official/乌托邦P',
                src: './music/反乌托邦Pt.2.mp3'
            },
            {
                title: 'Sacred Play Secret Place',
                artist: 'Matryoshka',
                src: './music/Sacred Play Secret Place.mp3'
            },
            {
                title: 'Summer(Nature\'s Crescendo)',
                artist: 'ConcernedApe',
                src: './music/Summer(Nature\'s Crescendo).mp3'
            },
            {
                title: 'Waltzing in the Rain',
                artist: 'Vincent Diamante',
                src: './music/Waltzing in the Rain.mp3'
            },
            {
                title: 'Butterfly Waltz',
                artist: 'Brian Crain',
                src: './music/Butterfly Waltz.mp3'
            }
        ]

    });
});
