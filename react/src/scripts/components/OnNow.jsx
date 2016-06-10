"use strict";
import React from 'react'
import { Grid, Col, Row, Input } from 'react-bootstrap'


const OnNow = React.createClass({
    getInitialState() {
        return {key: '', onNow: [], on24Count: 0}
    },
    onKeyChange(){
        //console.log("onKeyChange", key)
        this.setState({key: this.refs.key.getValue()})
    },
    refresh() {
        let key = this.refs.key.getValue()
        req.kl.graph(`{stats(key: ${key}) {
                            on {
                              lender_id
                              install
                              lender { 
                                name whereabouts loan_count
                                member_since(format:"MMM yyyy")
                                image { url(size:"s300") }
                              }
                              uptime
                            }
                            on24 { lender_id install }
                            }}`)
            .done(data => {
                if (data.stats) {
                    this.setState({
                        noResult: false,
                        key,
                        onNow: data.stats.on,
                        on24Count: data.stats.on24.length
                    })
                } else {
                    this.setState({ noResult: true })
                }
            })
    },
    render() {
        let { noResult, key, onNow, on24Count } = this.state
        const noImage = 'https://www.kiva.org/img/s200/726677.jpg'
        const getImg = onL => (onL && onL.lender && onL.lender.image) ? onL.lender.image.url : noImage

        return (
            <Grid>
                <Row>
                    <Col md={3}>
                        <Input
                            type="text"
                            ref="key"
                            value={key}
                            onChange={this.onKeyChange}
                            label="Key" />
                        <button onClick={this.refresh}>GO</button>
                    </Col>
                    {noResult ? "BAD KEY": ""}
                </Row>
                <Row>
                    {onNow.map((onL, i)=>{
                        return (<Col sm={3} key={i}>
                            <img src={getImg(onL)} style={{width:'200px',height:'200px',display:'block'}} />
                            <dl className="dl-horizontal narrow" style={{display:'block'}}>
                                <dt>lender</dt> <dd>{onL.lender ? <a href={`https://www.kiva.org/lender/${onL.lender_id}`}>{onL.lender_id}</a> : onL.lender_id}</dd>
                                <dt>install</dt> <dd>{onL.install}</dd>
                                <dt>uptime</dt> <dd>{onL.uptime}</dd>
                                <dt>name</dt> <dd>{onL.lender? onL.lender.name: ""}</dd>
                                <dt>since</dt> <dd>{onL.lender? onL.lender.member_since: ""}</dd>
                                <dt>location</dt> <dd>{onL.lender? onL.lender.whereabouts: ""}</dd>
                                <dt>loans</dt> <dd>{onL.lender? onL.lender.loan_count: ""}</dd>
                            </dl>
                        </Col>)
                    })}
                </Row>
                <Row>
                    On in last 24h: {on24Count}
                </Row>
            </Grid>

        );
    }
})

export default OnNow