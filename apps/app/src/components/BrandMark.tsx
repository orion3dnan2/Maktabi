export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="مكتبي">
      <svg className="brand__mark" viewBox="0 0 80 64" role="img" aria-hidden="true">
        <path d="M40 9v42M19 18h42M25 18 14 38h22L25 18Zm30 0L44 38h22L55 18Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10 38c2 8 7 12 15 12s13-4 15-12M40 38c2 8 7 12 15 12s13-4 15-12M31 55h18" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
      </svg>
      {!compact && <><strong>مكتبي</strong><span>Maktabi</span></>}
    </div>
  );
}
