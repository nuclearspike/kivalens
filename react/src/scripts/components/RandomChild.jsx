import React from 'react';

const RandomChild = React.createClass({
    getInitialState(){
        return {index: Math.floor(Math.random() * (this.props.children.length - 1))}
    },
    render() {return (<div>{this.props.children[this.state.index]}</div>)}
})

export default RandomChild