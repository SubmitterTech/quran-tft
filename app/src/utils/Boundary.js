import { Component } from 'react';

export default class Boundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        console.error('Error thrown:', error);
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('[Boundary] caught:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || null;
        }
        return this.props.children;
    }
}
