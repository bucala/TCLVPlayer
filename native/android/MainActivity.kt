package sk.tclv.player

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(TCLVPlayerPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
