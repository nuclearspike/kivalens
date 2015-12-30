'use strict'
import React from 'react'
import {Col,Row,Grid} from 'react-bootstrap'

const KLFooter = () => <Grid>
                <Row style={{paddingTop:'20px', paddingBottom:'50px'}}>
                    <Col md={12} className="ample-padding-top text-center">
                            &copy;{new Date().getFullYear()} KivaLens is not supported by Kiva.org.
                            See <a href="#/about">About</a> for contact information.
                    </Col>
                </Row>
            </Grid>


export default KLFooter;