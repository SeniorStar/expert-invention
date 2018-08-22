// @flow
import hoist from 'hoist-non-react-statics'
import React, { Component, createElement } from 'react'
import determineTheme from '../utils/determineTheme'
import { EMPTY_OBJECT } from '../utils/empties'
import generateDisplayName from '../utils/generateDisplayName'
import isTag from '../utils/isTag'
import isDerivedReactComponent from '../utils/isDerivedReactComponent'
import { ThemeConsumer } from './ThemeProvider'

import type { Theme } from './ThemeProvider'
import type { RuleSet, Target } from '../types'

// $FlowFixMe
class BaseStyledNativeComponent extends Component<*, *> {
  static target: Target
  static styledComponentId: string
  static attrs: Object
  static defaultProps: Object
  static inlineStyle: Object
  root: ?Object

  attrs = {}

  render() {
    return (
      <ThemeConsumer>
        {(theme?: Theme) => {
          const { forwardedClass, forwardedRef, style, ...props } = this.props
          const { defaultProps, target } = forwardedClass

          let generatedStyles
          if (theme !== undefined) {
            const themeProp = determineTheme(this.props, theme, defaultProps)
            generatedStyles = this.generateAndInjectStyles(
              themeProp,
              this.props
            )
          } else {
            generatedStyles = this.generateAndInjectStyles(
              theme || EMPTY_OBJECT,
              this.props
            )
          }

          const propsForElement = {
            ...this.attrs,
            ...props,
            style: [generatedStyles, style],
          }

          if (forwardedRef) propsForElement.ref = forwardedRef

          return createElement(target, propsForElement)
        }}
      </ThemeConsumer>
    )
  }

  buildExecutionContext(theme: any, props: any, attrs: any) {
    const context = { ...props, theme }

    if (attrs === undefined) return context

    this.attrs = {}

    let attr
    let key

    /* eslint-disable guard-for-in */
    for (key in attrs) {
      attr = attrs[key]

      this.attrs[key] =
        typeof attr === 'function' && !isDerivedReactComponent(attr)
          ? attr(context)
          : attr
    }
    /* eslint-enable */

    return { ...context, ...this.attrs }
  }

  generateAndInjectStyles(theme: any, props: any) {
    const { inlineStyle } = props.forwardedClass

    const executionContext = this.buildExecutionContext(
      theme,
      props,
      props.forwardedClass.attrs
    )

    return inlineStyle.generateStyleObject(executionContext)
  }

  setNativeProps(nativeProps: Object) {
    if (this.root !== undefined) {
      // $FlowFixMe
      this.root.setNativeProps(nativeProps)
    } else if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        'setNativeProps was called on a Styled Component wrapping a stateless functional component.'
      )
    }
  }
}

export default (InlineStyle: Function) => {
  const createStyledNativeComponent = (
    target: Target,
    options: Object,
    rules: RuleSet
  ) => {
    const {
      isClass = !isTag(target),
      displayName = generateDisplayName(target),
      ParentComponent = BaseStyledNativeComponent,
      attrs,
    } = options

    const inlineStyle = new InlineStyle(rules)

    class StyledNativeComponent extends ParentComponent {
      static attrs = attrs
      static displayName = displayName
      static inlineStyle = inlineStyle
      static styledComponentId = 'StyledNativeComponent'
      static target = target

      static withComponent(tag: Target) {
        const { displayName: _, componentId: __, ...optionsToCopy } = options
        const newOptions = {
          ...optionsToCopy,
          ParentComponent: StyledNativeComponent,
        }
        return createStyledNativeComponent(tag, newOptions, rules)
      }
    }

    const Forwarded = React.forwardRef((props, ref) => (
      <StyledNativeComponent
        {...props}
        forwardedClass={Forwarded}
        forwardedRef={ref}
      />
    ))

    /**
     * forwardRef creates a new interim component, so we need to lift up all the
     * stuff from StyledComponent such that integrations expecting the static properties
     * to be available will work
     */
    hoist(Forwarded, StyledNativeComponent)

    if (isClass) {
      // $FlowFixMe
      hoist(Forwarded, target, {
        // all SC-specific things should not be hoisted
        attrs: true,
        componentStyle: true,
        displayName: true,
        styledComponentId: true,
        target: true,
        warnTooManyClasses: true,
        withComponent: true,
      })
    }

    Forwarded.displayName = StyledNativeComponent.displayName

    return Forwarded
  }

  return createStyledNativeComponent
}
