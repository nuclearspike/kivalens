import React, { memo, useMemo } from 'react';
import PT from 'prop-types';
import KivaImage from '../KivaImage/KivaImage';
import { Card, Col, Row } from '../bs';

const selectNames = arr =>
  arr.map(b => `${b.firstName} (${b.gender[0].toUpperCase()})`).join(', ');

const ImageTab = memo(({ loan }) => {
  const imageCaption = useMemo(() => {
    const pictured = selectNames(loan.borrowers.filter(b => b.pictured));
    const notPictured = selectNames(loan.borrowers.filter(b => !b.pictured));

    return (
      <>
        {loan.borrowers.length > 1 && <p>In no particular order</p>}
        <p>Pictured: {pictured || '(none)'} </p>
        {notPictured.length > 0 && <p>Not Pictured: {notPictured} </p>}
      </>
    );
  }, [loan]);

  return (
    <>
      <Row>
        <Col xs={9}>
          <Card body>{imageCaption}</Card>
        </Col>
      </Row>
      <Row>
        <Col xs={9}>
          <KivaImage
            key={loan.id}
            useThumbAsBackground
            loan={loan}
            imageWidth={800}
            width="100%"
          />
        </Col>
      </Row>
    </>
  );
});

ImageTab.propTypes = {
  loan: PT.shape({
    id: PT.number,
    borrowers: PT.arrayOf(PT.object),
  }).isRequired,
};

ImageTab.displayName = 'ImageTab';

export default ImageTab;
