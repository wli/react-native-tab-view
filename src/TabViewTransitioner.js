/* @flow */

import React, { Component, PropTypes } from 'react';
import {
  Animated,
  View,
} from 'react-native';
import shallowCompare from 'react-addons-shallow-compare';
import { NavigationStatePropType } from './TabViewPropTypes';
import type { NavigationState, SceneRendererProps } from './TabViewTypeDefinitions';

type TransitionProps = {
  progress: number
}

type TransitionSpec = {
  timing: Function
}

type TransitionConfigurator = (currentTransitionProps: TransitionProps, nextTransitionProps: TransitionProps) => TransitionSpec

type DefaultProps = {
  configureTransition: TransitionConfigurator
}

type Props = {
  navigationState: NavigationState;
  render: (props: SceneRendererProps) => ?React.Element<any>;
  configureTransition: TransitionConfigurator;
  onRequestChangeTab: (index: number) => void;
  onChangePosition: (value: number) => void;
  shouldOptimizeUpdates: boolean;
  style?: any;
}

type State = {
  layout: {
    measured: boolean;
    width: number;
    height: number;
  };
  position: Animated.Value;
}

const DefaultTransitionSpec = {
  timing: Animated.spring,
  tension: 300,
  friction: 30,
};

export default class TabViewTransitioner extends Component<DefaultProps, Props, State> {
  static propTypes = {
    navigationState: NavigationStatePropType.isRequired,
    render: PropTypes.func.isRequired,
    configureTransition: PropTypes.func.isRequired,
    onRequestChangeTab: PropTypes.func.isRequired,
    onChangePosition: PropTypes.func,
    shouldOptimizeUpdates: PropTypes.bool,
    style: View.propTypes.style,
  };

  static defaultProps = {
    configureTransition: () => DefaultTransitionSpec,
  };

  constructor(props: Props) {
    super(props);

    this.state = {
      layout: {
        measured: false,
        width: 0,
        height: 0,
      },
      position: new Animated.Value(this.props.navigationState.index),
    };
  }

  state: State;

  componentDidMount() {
    this._positionListener = this.state.position.addListener(this._trackPosition);
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    if (this.props.shouldOptimizeUpdates === false) {
      return true;
    } else {
      return shallowCompare(this, nextProps, nextState);
    }
  }

  componentDidUpdate() {
    this._transitionTo(this.props.navigationState.index);
  }

  componentWillUnmount() {
    if (this._positionListener) {
      this.state.position.removeListener(this._positionListener);
    }
  }

  _nextIndex: ?number;
  _lastPosition: ?number;
  _positionListener: ?string;

  _trackPosition = (e: { value: number }) => {
    this._lastPosition = e.value;
    const { onChangePosition } = this.props;
    if (onChangePosition) {
      onChangePosition(e.value);
    }
  };

  _getLastPosition = () => {
    if (typeof this._lastPosition === 'number') {
      return this._lastPosition;
    } else {
      return this.props.navigationState.index;
    }
  };

  _handleLayout = (e: any) => {
    const { height, width } = e.nativeEvent.layout;

    this.setState({
      layout: {
        measured: true,
        height,
        width,
      },
    });
  };

  _buildSceneRendererProps = (): SceneRendererProps => {
    return {
      layout: this.state.layout,
      navigationState: this.props.navigationState,
      position: this.state.position,
      jumpToIndex: this._jumpToIndex,
      getLastPosition: this._getLastPosition,
    };
  }

  _transitionTo = (toValue: number, callback: Function) => {
    const lastPosition = this._getLastPosition();
    if (lastPosition === toValue) {
      return;
    }
    const currentTransitionProps = {
      progress: lastPosition,
    };
    const nextTransitionProps = {
      progress: toValue,
    };
    const transitionSpec = this.props.configureTransition(currentTransitionProps, nextTransitionProps);
    if (transitionSpec) {
      const { timing, ...transitionConfig } = transitionSpec;
      timing(this.state.position, {
        ...transitionConfig,
        toValue,
      }).start(callback);
    } else {
      this.state.position.setValue(toValue);
      if (callback) {
        callback();
      }
    }
  }

  _jumpToIndex = (index: number) => {
    this._nextIndex = index;
    this._transitionTo(index, () =>
      global.requestAnimationFrame(() => {
        if (this.props.navigationState.index === index) {
          return;
        }
        // Prevent extra setState when index updated mid-transition
        if (this._nextIndex === index) {
          this.props.onRequestChangeTab(index);
        }
      })
    );
  };

  render() {
    return (
      <View {...this.props} onLayout={this._handleLayout}>
        {this.props.render(this._buildSceneRendererProps())}
      </View>
    );
  }
}
