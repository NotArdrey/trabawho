function BrandWordmark({ className = '', ...props }) {
  const classes = ['gl-wordmark', className].filter(Boolean).join(' ');

  return (
    <span className={classes} {...props}>
      <span className="gl-wordmark-traba">Traba</span>
      <span className="gl-wordmark-who">Who</span>
    </span>
  );
}

export default BrandWordmark;
