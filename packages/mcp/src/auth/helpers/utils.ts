export const checkIssuerUrl = (issuer: URL): void => {
    // Technically RFC 8414 does not permit a localhost HTTPS exemption, but this will be necessary for ease of testing
    if (issuer.protocol !== "https:" && issuer.hostname !== "localhost" && issuer.hostname !== "127.0.0.1") {
        throw new Error("Issuer URL must be HTTPS");
    }
    if (issuer.hash) {
        throw new Error(`Issuer URL must not have a fragment: ${issuer}`);
    }
    if (issuer.search) {
        throw new Error(`Issuer URL must not have a query string: ${issuer}`);
    }
}