const isAuthenticated = (req, res, next) => {
  // This is a placeholder for a real session-based authentication check
  // In a real app, you would check for a valid session or token
  if (req.headers.authorization) {
    // a real app would decode a JWT here and check if the user is valid
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

module.exports = { isAuthenticated };
