package dk.hanskristoffer.tokenmaxxing.companion;

import static org.junit.Assert.*;
import org.junit.Test;

public class PairingLinkTest {
    private static final String SERVER = "https://tokenmaxxing.dk";
    private static final String CODE = "42.Abcdefghijklmnop_0123456789";

    @Test public void acceptsCodeAndOwnQrLink() {
        String expected = SERVER + "/play#code=" + CODE;
        assertEquals(expected, PairingLink.parse(SERVER, "  " + CODE + "\n"));
        assertEquals(expected, PairingLink.parse(SERVER, expected));
        assertEquals(expected, PairingLink.parse(SERVER, "https://TOKENMAXXING.dk:443/play#code=" + CODE));
    }

    @Test public void refusesPhishingAndExecutableLinks() {
        for (String value : new String[] {
                "https://evil.example/play#code=" + CODE,
                "https://tokenmaxxing.dk.evil.example/play#code=" + CODE,
                "https://evil.example@tokenmaxxing.dk/play#code=" + CODE,
                "https://tokenmaxxing.dk:444/play#code=" + CODE,
                "http://tokenmaxxing.dk/play#code=" + CODE,
                "javascript:alert(1)", "intent://play#code=" + CODE,
                "file:///play#code=" + CODE, "//tokenmaxxing.dk/play#code=" + CODE,
                SERVER + "/other#code=" + CODE,
                SERVER + "/play?code=" + CODE,
                SERVER + "/play#code=" + CODE + "&next=https://evil.example",
                "42.short", "not a code", "", null
        }) {
            assertThrows("Must reject " + value, IllegalArgumentException.class, () -> PairingLink.parse(SERVER, value));
        }
    }

    @Test public void navigationStaysOnConfiguredHttpsOrigin() {
        assertTrue(PairingLink.isTrusted(SERVER, SERVER + "/play"));
        assertFalse(PairingLink.isTrusted(SERVER, "file:///etc/passwd"));
        assertFalse(PairingLink.isTrusted(SERVER, "https://tokenmaxxing.dk.evil.example"));
        assertFalse(PairingLink.isTrusted(SERVER, "https://user@tokenmaxxing.dk/play"));
        assertFalse(PairingLink.isTrusted(SERVER, "http://tokenmaxxing.dk/play"));
    }
}
