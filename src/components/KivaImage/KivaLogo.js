import React, { memo } from 'react';

const KivaLogo = memo(() => {
  return (
    <img
      alt="Kiva Logo"
      style={{ height: 16, width: 16, verticalAlign: 'baseline' }}
      src="https://www-kiva-org.freetls.fastly.net/static/img/favicon-32x32.c0d3536.png"
    />
  );
});

KivaLogo.displayName = 'KivaLogo';

export default KivaLogo;
