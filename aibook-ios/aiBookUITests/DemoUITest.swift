import XCTest

/// Drives a full walkthrough of the app against the live Worker and captures a screenshot at
/// each step (as test attachments). A concurrent `simctl io recordVideo` captures the video.
final class DemoUITest: XCTestCase {
    let app = XCUIApplication()

    override func setUpWithError() throws {
        continueAfterFailure = true
        app.launchArguments = ["-uitestNoAutoAdvance"]
        app.launch()
    }

    func testWalkthrough() throws {
        sleep(4)
        snap("01-catalog")

        // Open Franklin (the only unlocked literary title).
        let franklin = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Autobiography'")).firstMatch
        XCTAssertTrue(franklin.waitForExistence(timeout: 10))
        franklin.tap()
        sleep(4)
        snap("02-reading-feed")

        // Auto-advance is disabled via launch argument, so the feed stays put.

        // Visualize a beat.
        let visualize = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Visualize'")).firstMatch
        if visualize.waitForExistence(timeout: 5) {
            visualize.tap()
            sleep(6)
            snap("03-visualize")
        }

        // Historian (critic)
        selectPersona("Historian")
        ask("What would a historian say about this beat")
        sleep(16)
        snap("04-historian")

        // Debate the author (Franklin)
        selectPersona("Franklin (author)")
        ask("Why did you leave your brother James")
        sleep(16)
        snap("05-debate-author")

        // Translator -> Hindi
        selectPersona("Translator")
        ask("Translate this beat into Hindi")
        sleep(15)
        snap("06-translate-hindi")
    }

    private func selectPersona(_ name: String) {
        let menu = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Talking to'")).firstMatch
        if menu.waitForExistence(timeout: 5) { menu.tap() }
        sleep(1)
        let item = app.buttons[name].firstMatch
        if item.waitForExistence(timeout: 5) { item.tap() }
        sleep(1)
    }

    private func ask(_ text: String) {
        let field = app.textFields["composer"]
        if field.waitForExistence(timeout: 5) {
            field.tap()
            field.typeText(text)
        }
        let send = app.buttons["Send"]
        if send.exists { send.tap() }
    }

    private func snap(_ name: String) {
        let shot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
