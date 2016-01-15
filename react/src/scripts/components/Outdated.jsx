import React from 'react'
import Reflux from 'reflux'
import {Grid,Alert} from 'react-bootstrap'
import a from '../actions'

const Outdated = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        return {}
    },
    componentDidMount() {
        var url = decodeURIComponent(this.props.location.query.attempt)
        a.utils.var.set('outdatedUrl', url)
        window.rga.event({category: 'outdatedLink', action: 'redirect', label: url})
        location.href = '#/search'
    },
    render() {return (<Grid><h4>Outdated Link...</h4></Grid>)}
})

export default Outdated