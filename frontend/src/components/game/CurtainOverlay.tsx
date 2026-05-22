interface CurtainOverlayProps {
  visible: boolean;
  moves: number;
  timeSeconds: number;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} мин ${s} сек` : `${s} сек`;
}

export function CurtainOverlay({ visible, moves, timeSeconds, onClose }: CurtainOverlayProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.85)',
        transition: 'opacity 0.4s ease',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* Curtain SVG background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMid slice"
          style={{ width: '100%', height: '100%', opacity: 0.4 }}
        >
          {/* Left curtain panel */}
          <path d="M0,0 Q80,300 40,600 L0,600 Z" fill="#5C0A14" />
          <path d="M40,0 Q120,300 80,600 L40,600 Z" fill="#7A1020" />
          <path d="M80,0 Q160,300 120,600 L80,600 Z" fill="#5C0A14" />
          <path d="M120,0 Q200,300 160,600 L120,600 Z" fill="#7A1020" />
          <path d="M160,0 Q240,300 200,600 L160,600 Z" fill="#5C0A14" />

          {/* Right curtain panel */}
          <path d="M800,0 Q720,300 760,600 L800,600 Z" fill="#5C0A14" />
          <path d="M760,0 Q680,300 720,600 L760,600 Z" fill="#7A1020" />
          <path d="M720,0 Q640,300 680,600 L720,600 Z" fill="#5C0A14" />
          <path d="M680,0 Q600,300 640,600 L680,600 Z" fill="#7A1020" />
          <path d="M640,0 Q560,300 600,600 L640,600 Z" fill="#5C0A14" />

          {/* Gold tassels - left */}
          <circle cx="200" cy="580" r="12" fill="#D4AF37" />
          <line x1="200" y1="560" x2="200" y2="580" stroke="#D4AF37" strokeWidth="3" />
          <circle cx="160" cy="575" r="10" fill="#D4AF37" />
          <line x1="160" y1="555" x2="160" y2="575" stroke="#D4AF37" strokeWidth="3" />
          <circle cx="120" cy="585" r="11" fill="#D4AF37" />
          <line x1="120" y1="565" x2="120" y2="585" stroke="#D4AF37" strokeWidth="3" />

          {/* Gold tassels - right */}
          <circle cx="600" cy="580" r="12" fill="#D4AF37" />
          <line x1="600" y1="560" x2="600" y2="580" stroke="#D4AF37" strokeWidth="3" />
          <circle cx="640" cy="575" r="10" fill="#D4AF37" />
          <line x1="640" y1="555" x2="640" y2="575" stroke="#D4AF37" strokeWidth="3" />
          <circle cx="680" cy="585" r="11" fill="#D4AF37" />
          <line x1="680" y1="565" x2="680" y2="585" stroke="#D4AF37" strokeWidth="3" />

          {/* Top valance */}
          <rect x="0" y="0" width="800" height="40" fill="#5C0A14" />
          <path d="M0,40 Q100,70 200,40 Q300,70 400,40 Q500,70 600,40 Q700,70 800,40 L800,0 L0,0 Z" fill="#7A1020" />
          {/* Gold trim */}
          <path d="M0,40 Q100,70 200,40 Q300,70 400,40 Q500,70 600,40 Q700,70 800,40" fill="none" stroke="#D4AF37" strokeWidth="2" />
        </svg>
      </div>

      {/* Content card */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: 'rgba(20, 10, 5, 0.92)',
          border: '2px solid #D4AF37',
          borderRadius: '16px',
          padding: '40px 48px',
          textAlign: 'center',
          maxWidth: '420px',
          width: '90%',
          boxShadow: '0 0 60px rgba(212, 175, 55, 0.3)',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🏆</div>
        <h1 style={{ color: '#D4AF37', fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '0.05em' }}>
          БРАВО!
        </h1>
        <p style={{ color: '#F5E6C8', fontSize: '1.25rem', marginBottom: '4px' }}>
          Ты победил(а) Нику
        </p>
        <p style={{ color: '#D4AF37', fontSize: '1.1rem', marginBottom: '16px' }}>
          за {moves} ходов.
        </p>
        <div
          style={{
            background: 'rgba(212, 175, 55, 0.1)',
            border: '1px solid rgba(212, 175, 55, 0.4)',
            borderRadius: '8px',
            padding: '12px 20px',
            marginBottom: '24px',
          }}
        >
          <p style={{ color: '#D4AF37', fontSize: '0.9rem', marginBottom: '4px' }}>Время</p>
          <p style={{ color: '#F5E6C8', fontSize: '1.1rem', fontWeight: 'bold' }}>
            {formatTime(timeSeconds)}
          </p>
        </div>
        <p style={{ color: '#D4AF37', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '24px', letterSpacing: '0.1em' }}>
          ДЖЕКПОТ! 🎰
        </p>
        <button
          onClick={onClose}
          style={{
            background: 'linear-gradient(135deg, #D4AF37, #F5C842)',
            color: '#1a0a00',
            border: 'none',
            borderRadius: '12px',
            padding: '14px 32px',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            width: '100%',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          Поднять занавес
        </button>
      </div>
    </div>
  );
}
