const rand = () => {
  return Math.random().toString(36).substr(2)
}

export function getRandomState() {
  return `${rand()}-${rand()}-${rand()}`
}