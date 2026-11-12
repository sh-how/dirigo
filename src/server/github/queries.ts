// GraphQL queries for syncing one repository. Only metadata fields are requested:
// no bodies, comments, diffs or file contents.

export const REPOSITORY_QUERY = /* GraphQL */ `
  query Repository($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      databaseId nameWithOwner name url isPrivate owner { login }
      milestones(states: OPEN, first: 50, orderBy: { field: DUE_DATE, direction: ASC }) {
        nodes {
          number title dueOn url
          openIssues: issues(states: OPEN) { totalCount }
          closedIssues: issues(states: CLOSED) { totalCount }
          openPullRequests: pullRequests(states: OPEN) { totalCount }
          closedPullRequests: pullRequests(states: [CLOSED, MERGED]) { totalCount }
        }
      }
    }
  }
`;

export const ISSUES_QUERY = /* GraphQL */ `
  query Issues($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      issues(states: OPEN, first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number title url createdAt updatedAt
          assignees(first: 10) { nodes { login } }
          labels(first: 20) { nodes { name } }
          milestone { title }
        }
      }
    }
  }
`;

export const PULL_REQUESTS_QUERY = /* GraphQL */ `
  query PullRequests($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequests(states: OPEN, first: 25, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number title url createdAt updatedAt isDraft reviewDecision changedFiles
          author { login }
          assignees(first: 10) { nodes { login } }
          labels(first: 20) { nodes { name } }
          milestone { title }
          reviewRequests(first: 20) {
            nodes { requestedReviewer { __typename ... on User { login } ... on Team { slug } ... on Bot { login } ... on Mannequin { login } } }
          }
          latestReviews(first: 20) { nodes { author { login } state submittedAt } }
          closingIssuesReferences(first: 10) { nodes { number repository { nameWithOwner } } }
          statusCheckRollup {
            state
            contexts(first: 100) {
              nodes {
                __typename
                ... on CheckRun { conclusion status startedAt completedAt }
                ... on StatusContext { state createdAt }
              }
            }
          }
          timelineItems(last: 20, itemTypes: [REVIEW_REQUESTED_EVENT, READY_FOR_REVIEW_EVENT]) {
            nodes {
              __typename
              ... on ReviewRequestedEvent { createdAt requestedReviewer { __typename ... on User { login } ... on Team { slug } ... on Bot { login } } }
              ... on ReadyForReviewEvent { createdAt }
            }
          }
        }
      }
    }
  }
`;

export const CLOSED_ISSUES_QUERY = /* GraphQL */ `
  query ClosedIssues($owner: String!, $name: String!, $since: DateTime!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      issues(states: CLOSED, first: 100, after: $cursor, filterBy: { since: $since }, orderBy: { field: UPDATED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes { number closedAt milestone { number } }
      }
    }
  }
`;

export const CLOSED_PULL_REQUESTS_QUERY = /* GraphQL */ `
  query ClosedPullRequests($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequests(states: [CLOSED, MERGED], first: 100, after: $cursor, orderBy: { field: UPDATED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes { number closedAt updatedAt milestone { number } }
      }
    }
  }
`;
