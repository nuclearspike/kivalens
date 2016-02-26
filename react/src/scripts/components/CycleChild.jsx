'use strict'

import React from 'react'

/**
 * each time it mounts, it will display the next child component
 * and keep track of it's last index shown in localStorage.
 */

const CycleChild = React.createClass({
    getInitialState(){return {index: 0}},
    shouldComponentUpdate(){return false},
    componentDidMount(){
        var index
        index = parseInt(localStorage.getItem(this.props.name))
        if (isNaN(index)) index = -1
        index++
        index = index % this.props.children.length
        localStorage.setItem(this.props.name, index)
        this.setState({index})
        this.forceUpdate()
    },
    render() {
        return <span>{this.props.children[this.state.index]}</span>
    }
})

export default CycleChild