import { render, screen } from '@testing-library/react'
import { Empty, ErrorState, Skeleton, StatusBadge } from '../components/ui'
import { parsePayload, unwrapList } from '../lib/util'

describe('ui', () => {
  it('renders status badge', () => {
    render(<StatusBadge status="failed" />)
    expect(screen.getByText('failed')).toBeInTheDocument()
  })
  it('renders empty and error states', () => {
    render(<><Empty title="No jobs found" /><ErrorState message="Network Error" /><Skeleton /></>)
    expect(screen.getByText('No jobs found')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Network Error')
    expect(screen.getByTestId('skeleton')).toBeInTheDocument()
  })
})

describe('util', () => {
  it('validates JSON payloads', () => {
    expect(parsePayload('{"a":1}').value).toEqual({ a: 1 })
    expect(parsePayload('{bad').error).toBeTruthy()
    expect(parsePayload('').value).toEqual({})
  })
  it('unwraps list responses', () => {
    expect(unwrapList([1])).toEqual([1])
    expect(unwrapList({ jobs: [2] })).toEqual([2])
    expect(unwrapList({})).toEqual([])
  })
})
