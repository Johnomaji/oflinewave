const Noop = () => null;
module.exports = {
  Document: Noop,
  Page: Noop,
  View: Noop,
  Text: Noop,
  Image: Noop,
  StyleSheet: { create: (s) => s },
  renderToBuffer: async () => Buffer.from("%PDF-stub"),
};
