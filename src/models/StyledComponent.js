// @flow
import { Component, createElement, PropTypes } from 'react'

import ComponentStyle from '../models/ComponentStyle'
import validAttr from '../utils/validAttr'

import type { RuleSet, Target } from '../types'

/* eslint-disable react/prefer-stateless-function */
class AbstractStyledComponent extends Component {
}

const createStyledComponent = (target: Target, rules: RuleSet) => {
  /* Handle styled(OtherStyledComponent) differently */
  const isStyledComponent = {}.isPrototypeOf.call(AbstractStyledComponent, target)
  if (isStyledComponent) return createStyledComponent(target.target, target.rules.concat(rules))

  const isTag = typeof target === 'string'
  const componentStyle = new ComponentStyle(rules)

  class StyledComponent extends AbstractStyledComponent {
    theme: Object
    generatedClassName: string
    static rules: RuleSet
    static target: Target

    getChildContext() {
      return { theme: this.theme }
    }

    componentWillMount() {
      this.componentWillReceiveProps(this.props, this.context)
    }

    componentWillReceiveProps(newProps: Object, newContext: ?any) {
      this.theme = (newContext && newContext.theme) || {} // pass through theme
      const theme = Object.assign({}, this.theme) // copy to pass to styles so no side effects
      const updateTheme = values => {
        this.theme = Object.assign({}, this.theme, values)
      }
      /* Execution context is props + theme + updateTheme */
      const executionContext = Object.assign({}, newProps, { theme, updateTheme })
      /* Do all the work to generate the CSS because this can modify the theme */
      this.generatedClassName = componentStyle.generateAndInjectStyles(executionContext)
    }

    /* eslint-disable react/prop-types */
    render() {
      const { className, children } = this.props

      const propsForElement = {}
      /* Don't pass through non HTML tags through to HTML elements */
      Object.keys(this.props)
        .filter(propName => !isTag || validAttr(propName))
        .forEach(propName => {
          propsForElement[propName] = this.props[propName]
        })
      propsForElement.className = [className, this.generatedClassName].filter(x => x).join(' ')

      return createElement(target, propsForElement, children)
    }
  }

  /* Used for inheritance */
  StyledComponent.rules = rules
  StyledComponent.target = target

  StyledComponent.displayName = isTag ? `styled.${target}` : `Styled(${target.displayName})`
  StyledComponent.childContextTypes = {
    theme: PropTypes.object,
  }
  StyledComponent.contextTypes = {
    theme: PropTypes.object,
  }
  return StyledComponent
}

export default createStyledComponent
